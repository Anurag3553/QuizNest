const mongoose = require("mongoose");
const initdata = require("./data.js");
const CreateQuiz = require("../models/listing.js");

main().then(() => {
    console.log("Connected to DB");
})
    .catch(err => console.log(err));

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/quiznest');
}

const initDB = async () => {
    await CreateQuiz.deleteMany({});
    await CreateQuiz.insertMany(initdata.data);
    console.log("Data was Initalised");
};

initDB();