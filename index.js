const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

const corsOptions = {
    origin: ['http://localhost:5173',
        'https://b9a11-restaurant-management.web.app',
        'https://b9a11-restaurant-management.firebaseapp.com'],
    credentials: true,
    optionSuccessStatus: true,
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser())


// verify jwt middleware
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token
    if (!token) return res.status(401).send({ message: 'unauthorized access' })
    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log(err)
                return res.status(401).send({ message: 'unauthorized access' })
            }
            console.log(decoded)

            req.user = decoded
            next()
            console.log(req.user);
        })
    }
}


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
        const purchaseCollection = client.db('restaurent').collection('food');


        // jwt generate
        app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })

        // Clear token on logout
        app.get('/logout', (req, res) => {
            res
                .clearCookie('token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    maxAge: 0,
                })
                .send({ success: true })
        })

        // Connect the client to the server	(optional starting in v4.7)
        //   await client.connect();

        app.get('/gallery', async (req, res) => {
            const result = await galleryCollection.find().toArray();
            res.send(result);
        });

        app.get('/food', async (req, res) => {
            let sortQuery = { purchaseCount: 1 };
            const { sort } = req.query;
            if (sort === 'purchaseCount_DESC') {
                sortQuery = { purchaseCount: -1 };
            }

            try {
                const result = await foodCollection.find({}).sort(sortQuery).limit(6).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching top foods:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });


        app.get('/food/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await foodCollection.findOne(query);
            res.send(result);
        })


        app.get('/myItem/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user.email;
            const userEmail = req.params.email;
            if (tokenEmail !== userEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const result = await foodCollection.find({ email: req.params.email }).toArray();
            res.send(result);
        })

        // for purchase method

        app.get('/purchase', async (req, res) => {
            const result = await purchaseCollection.find().toArray();
            res.send(result);
        });


        app.get('/purchase/:id', verifyToken, async (req, res) => {
            if (req.user.email) {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await purchaseCollection.findOne(query);
                res.send(result);
            }
        })

        app.get('/myOrder/:email', verifyToken, async (req, res) => {

            const tokenEmail = req.user.email;
            const userEmail = req.params.email
            console.log(tokenEmail == userEmail);
            if (tokenEmail !== userEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const result = await purchaseCollection.find({ 'buyer.buyer_email': userEmail }).toArray();
            res.send(result);
        });



        // for gallery
        app.post('/gallery', async (req, res) => {
            const newGallery = req.body;
            const result = await galleryCollection.insertOne(newGallery);
            res.send(result);
        });

        // for All foods
        app.post('/food', async (req, res) => {
            const newFood = req.body;
            const result = await foodCollection.insertOne(newFood);
            res.send(result);
        });

        // for purchased food
        app.post('/purchase', async (req, res) => {
            const purchaseFood = req.body;
            const foodId = purchaseFood.foodId;
            const result = await purchaseCollection.insertOne(purchaseFood);
            const updateDoc = {
                $inc: { purchaseCount: 1 },
            }
            const foodQuery = { _id: new ObjectId(foodId) }
            const updatePurchaseCount = await foodCollection.updateOne(foodQuery, updateDoc)

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
            // console.log('object deleted', id);
            const query = { _id: new ObjectId(id) };
            const result = await foodCollection.deleteOne(query);
            res.send(result);
        })

        // for purchase items

        app.delete('/purchase/:id', async (req, res) => {
            const id = req.params.id;
            console.log('object deleted', id);
            const query = { _id: new ObjectId(id) };
            const result = await purchaseCollection.deleteOne(query);
            console.log(result);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
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
