const express = require("express");
const mongoose = require("mongoose");
const app = express();
const CreateQuiz = require("./models/listing.js");
const path = require("path");
const Listing = require("./MAJORPROJECT/models/listing.js");
const methodOverride = require("method-override");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bodyParser = require("body-parser");
require("dotenv").config();


main().then(() => {
    console.log("Connected to DB");
})
    .catch(err => console.log(err));

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/quiznest');
}

// Ensure the API key is loaded
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    console.error("API_KEY environment variable is not set.");
    process.exit(1);
}

// Instantiate the Gemini API
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended : true}));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));


app.get("/home/dashboard", (req, res) => {
    res.render("Listings/Dashboard.ejs");
});

//Quizz Route
app.get("/home/dashboard/quizzes", async(req, res) => {
    const allquiz = await CreateQuiz.find({});
    res.render("Listings/quiz.ejs", {allquiz});
});

//Show Quizzes
app.get("/home/dashboard/quizzes/:id" , async(req, res) => {
    let {id} = req.params;
    const quiz = await CreateQuiz.findById(id);
    res.render("Listings/showquizzes.ejs", {quiz});
});

//Show Quiz-Result
app.post('/home/dashboard/quizzes/:id/submit', async (req, res , next) => {
  try{
    const quiz = await CreateQuiz.findById(req.params.id);
    const userAnswers = req.body; // object like { "question-0": "George Washington", "question-1": "1945" }
  
    const startTime = new Date(req.body.startTime);
    const submitTime = new Date(req.body.submitTime);
  
    let results = [];
    let correctCount = 0;
  
    quiz.questions.forEach((question, index) => {
      const selected = userAnswers[`question-${index}`];
  
      const correctOption = question.options.find(opt => opt.isCorrect === true);
  
      const isCorrect = selected === correctOption.text;
      if (isCorrect) correctCount++;
  
      results.push({
        questionText: question.questionText,
        selected,
        correct: correctOption.text,
        isCorrect: selected === correctOption.text
      });
    });
  
  
    const totalScore = correctCount * quiz.points;
    const incorrectCount = quiz.questions.length - correctCount;
    res.render('Listings/quiz-result.ejs', { results, quiz ,correctCount,
      totalQuestions: quiz.questions.length,
      totalScore,startTime: new Date(req.body.startTime),
      submitTime: new Date(req.body.submitTime) , incorrectCount});
    }catch(err){
      next(err);
    }
  });


//Admin
app.get("/home/dashboard/admin", (req, res) => {
  res.render("Listings/Admin.ejs");
});

app.get("/admin", (req, res) => {
  res.render("Listings/Admin.ejs");
})

//- show route , Create Quiz
app.get("/admin/createquiz", (req, res) => {
  res.render("Listings/createquiz.ejs");
});

app.post("/admin/createquiz", async (req, res, next) => {
  try {
    const quizData = req.body.quiz;

    quizData.questions.forEach((question) => {
      question.options.forEach((option) => {
        option.isCorrect = option.isCorrect === 'on';
      });
    });

    let newQuiz = new CreateQuiz(quizData);
    await newQuiz.save();
    res.redirect("/admin/dashboard");
  } catch (err) {
    next(err);
    // console.error(err);
    // res.status(500).send("Something went wrong!");
  }
});

app.get("/admin/dashboard", async(req, res) => {
  const allquiz = await CreateQuiz.find({});
  res.render("Listings/admin-dashboard.ejs", {allquiz});
});

app.get("/admin/dashboard/:id", async(req, res) => {
  let {id} = req.params;
  const aquiz = await CreateQuiz.findById(id);
  res.render("Listings/Review.ejs", {aquiz});
});

//Generate via Ai
app.get("/admin/generatequiz", (req, res) => {
    // FIX: Pass quiz: null to prevent "quiz is not defined" error
    res.render("Listings/genAi.ejs", { quiz: null, error: null });
});

app.post("/admin/generatequiz/ask", async (req, res) => {
    const { quizName, subject, points, timeLimit, noOfQuestions, description, noOfOptions } = req.body;
    
    // Validate required fields
    if (!quizName || !subject || !noOfQuestions || !noOfOptions) {
        return res.render("Listings/genAi.ejs", { 
            quiz: null, 
            error: "Please fill in all required fields (Quiz Name, Subject, No. of Questions, No. of Options)." 
        });
    }

    const prompt = `Create a quiz about "${subject}" titled "${quizName}". The quiz should have exactly ${noOfQuestions} questions. Each question must have exactly ${noOfOptions} options. Provide one correct answer for each question. The quiz should be in JSON format. The structure should match this example: 
    {
        "quizName": "Quiz Title",
        "subject": "Quiz Subject",
        "points": 10,
        "timeLimit": 60,
        "noOfQuestions": 5,
        "description": "A brief description of the quiz.",
        "questions": [
            {
                "questionText": "Question 1 text?",
                "options": [
                    {"text": "Option A", "isCorrect": false},
                    {"text": "Option B", "isCorrect": true},
                    {"text": "Option C", "isCorrect": false},
                    {"text": "Option D", "isCorrect": false}
                ]
            },
            ...
        ]
    }`;

    try {
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        quizName: { "type": "STRING" },
                        subject: { "type": "STRING" },
                        points: { "type": "NUMBER" },
                        timeLimit: { "type": "NUMBER" },
                        noOfQuestions: { "type": "NUMBER" },
                        description: { "type": "STRING" },
                        questions: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    questionText: { "type": "STRING" },
                                    options: {
                                        type: "ARRAY",
                                        items: {
                                            type: "OBJECT",
                                            properties: {
                                                text: { "type": "STRING" },
                                                isCorrect: { "type": "BOOLEAN" }
                                            },
                                            "propertyOrdering": ["text", "isCorrect"]
                                        }
                                    }
                                },
                                "propertyOrdering": ["questionText", "options"]
                            }
                        },
                    },
                    "propertyOrdering": ["quizName", "subject", "points", "timeLimit", "noOfQuestions", "description", "questions"]
                }
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) {
            throw new Error("Invalid response format from Gemini API.");
        }

        const quizData = JSON.parse(jsonText);

        // Save the generated quiz to MongoDB using Mongoose
        const newQuiz = new CreateQuiz({
            ...quizData,
            // Override AI values with user's input for consistency
            quizName: quizName,
            subject: subject,
            points: parseInt(points) || quizData.points,
            timeLimit: parseInt(timeLimit) || quizData.timeLimit,
            noOfQuestions: parseInt(noOfQuestions) || quizData.noOfQuestions,
            description: description || quizData.description
        });
        await newQuiz.save();
        
        res.render("Listings/genAi.ejs", { quiz: newQuiz, error: null });

    } catch (err) {
        console.error("Error creating quiz:", err);
        res.render("Listings/genAi.ejs", { 
            quiz: null, 
            error: `An error occurred while generating the quiz: ${err.message}` 
        });
    }
});

//edit
app.get("/admin/dashboard/:id/edit", async(req, res) => {
  let {id} = req.params;
  const quiz = await CreateQuiz.findById(id);
  res.render("Listings/edit.ejs", {quiz});
});
//Update
app.put("/admin/dashboard/:id", async(req, res) => {
  let {id} = req.params;
  await CreateQuiz.findByIdAndUpdate(id, {...req.body.quiz});
  res.redirect("/admin/dashboard");
});


//delete
app.delete("/admin/dashboard/:id", async(req, res) => {
  let {id} = req.params;
  await CreateQuiz.findByIdAndDelete(id);
  res.redirect("/admin/dashboard");
});

//student dashboard
app.get("/home/dashboard/stu-dashboard", (req, res) => {
  res.render("Listings/stud-dashboard.ejs");
});


app.get("/home", (req, res) => {
  try{
    res.render("Listings/home.ejs");
  }catch(err){
    next(err);
  }
});

app.use((err , req, res, next) => {
  res.send("Something went wrong");
});
app.listen(8080, () => {
    console.log("Server is listening on port 8080");
});