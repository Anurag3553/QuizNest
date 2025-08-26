const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const quizSchema = new Schema({
  quizName: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  points: {
    type: Number,
    required: true,
  },
  timeLimit: Number, // in minutes or seconds
  noOfQuestions: Number,
  description: String,

  // Embedding questions
  questions: [
    {
      questionText: {
        type: String,
        required: true,
      },
      options: [
        {
          text: {
            type: String,
            required: true,
          },
          isCorrect: {
            type: Boolean,
            required: true,
          },
        },
      ],
    }
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const CreateQuiz = new mongoose.model("CreateQuiz", quizSchema);
module.exports = CreateQuiz;