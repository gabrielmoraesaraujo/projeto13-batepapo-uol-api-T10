import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import cors from 'cors';
import dayjs from 'dayjs';


dotenv.config();  //configuração do dotenv

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI); //conectando ao banco
let db;
mongoClient.connect(() => {
  db = mongoClient.db("db_uol");
}); 

//Estabelecendo objetos
const participanteSchema = joi.object({
    name: joi.string().required()
})

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().pattern(/message/, /private_message/),
    from: joi.string().required()
})


//CRIAÇÃO DE ROTAS
app.get('/participants', async (req, res) => {
    try {
      const participants = await db.collection('participants').find().toArray();
      res.send(participants);
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  });

app.post('/participants', async (req, res) => {
    const participant = req.body;
    const message = {from: participant.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:mm:ss')};

    const validation = participanteSchema.validate(participant, { abortEarly: true});

    if(validation.error){
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }
    
    try{
        const participants = await db.collection('participants').find().toArray();
        const nameExists = participants.some(p => p.name === participant.name);

        if(nameExists === false){
        const { name } = participant;

        await db.collection('participants').insertOne({ name, 'lastStatus': Date.now() });
        await db.collection('messages').insertOne(message);

        res.sendStatus(201);
        }else{
            res.status(409).send("Já existe um participante com este nome!");
        }
    }catch(error){
        console.error(error);
        res.sendStatus(500);
    }

});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user;
	
    try{
        if(limit){
            const messages = await db.collection('messages').find({ $or: [  {to: "Todos"}, {to: user}, {from: user}, {type: "message"} ] }).sort({_id: -1}).limit(limit).toArray();
            res.send(messages.reverse());
        }else{
            const messages = await db.collection('messages').find({ $or: [  {to: "Todos"}, {to: user}, {from: user} ] }).toArray();
            res.send(messages.reverse());
        }

    }catch(error){
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/messages', async(req, res) => {
    const { to, text, type } = req.body;
    const userFrom = req.headers.user;
    const message = { to, text, type, from: userFrom };

    const validation = messageSchema.validate(message, { abortEarly: true});

    if(validation.error){
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }

    try{
    const participants = await db.collection('participants').find().toArray();
    const userFromExists = participants.some(p => p.name === userFrom);
    const time = dayjs().format('HH:mm:ss');

    if(userFromExists){
        await db.collection('messages').insertOne({...message, time});
        res.sendStatus(201);
    }else{
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }

    }catch(error){
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;


    if(user){
        try{
            const userId = await db.collection('participants').findOne({ name: user });
            if(!userId){
                res.sendStatus(404);
                return;
            }
            const time = Date.now();
            await db.collection('participants').updateOne({ _id: userId._id }, { $set: {lastStatus: time}});
            res.sendStatus(200);
        
        }catch(error){
            console.error(error);
            res.sendStatus(500);
        }


    }else{
     res.sendStatus(404);
    }
});




setInterval(async () => { 
    const timeNowMinus10s = Date.now() - 10000;
    
    try{
        const deleteParticipants = await db.collection('participants').find({ lastStatus: {$lt: timeNowMinus10s} }).toArray();

        const deletedParticipants = await db.collection('participants').deleteMany({lastStatus: {$lt: timeNowMinus10s}});
 
        deleteParticipants.forEach(saiDaSala);

    async function saiDaSala(item, indice){
        const message = {from: item.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format('HH:mm:ss')};
        const sairam = await db.collection('messages').insertOne(message);
        console.log(sairam);
    }

    }catch(error){
        console.error(error);
    }
    
}, 15000);



//estabelecendo conexão com o banco
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server is litening on port: ${PORT}`))