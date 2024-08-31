const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'https://b9-a11-volunteer-management.web.app', 'https://b9-a11-volunteer-management.firebaseapp.com'],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json());
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xwmcx9f.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    const volunteerCollection = client.db('volunteerManagement').collection('volunteers')
    const beVolunteerCollection = client.db('volunteerManagement').collection('beVolunteer')

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d'
      })
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      })
        .send({ success: true })
    })

    // Clear token on logout
    app.get('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: 0,
      })
        .send({ success: true })
    })

    // middleware/ verify Token 
    const verifyToken = async (req, res, next) => {
      const token = req.cookies?.token;
      if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
          }
          req.user = decoded;
          next();
        })
      }
    }




    // Get all volunteer need now data
    app.get('/volunteers', async (req, res) => {
      const result = await volunteerCollection.find().sort({ deadline: -1 }).toArray();
      res.send(result)
    })

    // Get a single  volunteer data from by id
    app.get('/volunteer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await volunteerCollection.findOne(query)
      res.send(result)
    })

    // ‍save a volunteer data 
    app.post('/volunteer', async (req, res) => {
      const data = req.body;
      const result = await volunteerCollection.insertOne(data);
      res.send(result)
    })
    // get all volunteer by a specific user
    app.get('/needVolunteer/:email', verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { 'takeVolunteer.email': email };
      const result = await volunteerCollection.find(query).toArray();
      res.send(result)
    })
    // ‍Delete from volunteer data  
    app.delete('/volunteer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await volunteerCollection.deleteOne(query)
      console.log(result);
      res.send(result)
    })

    // ‍Update a data  volunteer in db
    app.put('/volunteer/:id', async (req, res) => {
      const id = req.params.id;
      const allData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...allData,
        },
      }
      const result = await volunteerCollection.updateOne(query, updateDoc, options);
      res.send(result)
    })

    // Get all need volunteer data
    app.get('/allVolunteers', async (req, res) => {
      const size = parseInt(req.query.size)
      const page = parseInt(req.query.page) - 1
      const search = req.query.search
      let query = {
        postTitle: { $regex: search, $options: 'i' },
      }
      const result = await volunteerCollection.find(query).skip(page * size).limit(size).toArray();
      res.send(result)
    })
    // Get all volunteer data for pagination
    app.get('/volunteersCount', async (req, res) => {
      const search = req.query.search
      let query = {
        postTitle: { $regex: search, $options: 'i' },
      }
      const pageNum = await volunteerCollection.countDocuments(query)
      res.send({ pageNum })
    })





    // ‍************ beVolunteer data *************
    
    app.get('/beVolunteer', async (req, res) => {
      const result = await beVolunteerCollection.find().toArray();
      res.send(result)
    })

    app.get('/beVolunteer/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { 'takeVolunteer.email': email };
      const result = await beVolunteerCollection.find(query).toArray();
      res.send(result)
    })
    app.get('/myRequest/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { email: email };
      const result = await beVolunteerCollection.find(query).toArray();
      res.send(result)
    })
    // ‍save beVolunteer data  and $inc
    app.post('/beVolunteer', async (req, res) => {
      const data = req.body; 
      const result = await beVolunteerCollection.insertOne(data); 
      const newId = req.query.id
       const query = {_id: new ObjectId(newId)}
      const updateDoc = {
        $inc: {
          noVolunteer: -1
        }
      }    
      const updateNoVolunteer = await volunteerCollection.updateOne(query, updateDoc)
      res.send(updateNoVolunteer)
    })

    // ‍Delete from beVolunteer data  
    app.delete('/beVolunteer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await beVolunteerCollection.deleteOne(query)
      res.send(result)
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Volunteer join in club is running')
})
app.listen(port, () => {
  console.log(`Volunteer management in club is running in ${port}`)
})