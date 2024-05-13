const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: true,
}

app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9ola8x0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const galleryCollection = client.db('restaurent').collection('gallery');
        const foodCollection = client.db('restaurent').collection('foods');



        // Connect the client to the server	(optional starting in v4.7)
        //   await client.connect();

        app.get('/gallery', async (req, res) => {
            const result = await galleryCollection.find().toArray();
            res.send(result);
        });

        app.get('/food', async (req, res) => {
            const result = await foodCollection.find().toArray();
            res.send(result);
        });

        app.get('/food/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await foodCollection.findOne(query);
            res.send(result);
        })

        app.get('/myItem/:email', async (req, res) => {
            console.log(req.params.email);
            const result = await foodCollection.find({ email: req.params.email }).toArray();
            res.send(result);
        })


        app.post('/gallery', async (req, res) => {
            const newGallery = req.body;
            const result = await galleryCollection.insertOne(newGallery);
            res.send(result);
        });

        app.post('/food', async (req, res) => {
            const newFood = req.body;
            console.log(newFood);
            const result = await foodCollection.insertOne(newFood);
            res.send(result);
        });

        app.get('/all-foods', async (req, res) => {
            const size = parseInt(req.query.size);
            const page = parseInt(req.query.page) - 1;

            let search = req.query.search;


            if (typeof search !== 'string') {
                search = '';
            }

            const query = {
                name: { $regex: search, $options: 'i' },
            };

            const result = await foodCollection
                .find(query)
                .skip(page * size)
                .limit(size)
                .toArray();

            res.send(result);
        });

        // Get all foods data count from db
        app.get('/foods-count', async (req, res) => {
            // const filter = req.query.filter
            const search = req.query.search
            let query = {
                name: { $regex: search, $options: 'i' },
            }
            // if (filter) query.category = filter
            const count = await foodCollection.countDocuments(query)
            res.send({ count })
        })


        app.put('/food/:id', async (req, res) => {
            const id = req.params.id;
            const user = req.body;
            console.log(user);
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedUser = {
                $set: {
                    ...user
                }
            }
            const result = await foodCollection.updateOne(filter, updatedUser, options);
            res.send(result);
        })


        app.delete('/food/:id', async (req, res) => {
            const id = req.params.id;
            console.log('object deleted', id);
            const query = { _id: new ObjectId(id) };
            const result = await foodCollection.deleteOne(query);
            res.send(result);

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
    res.send('Welcome...');
}); // <- added closing parenthesis here

app.listen(port, () => {
    console.log(`Server running on port : ${port}`);
});
