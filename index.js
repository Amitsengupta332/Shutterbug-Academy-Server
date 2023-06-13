const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;



//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {

    //get authorization token 
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    //bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wt8oomr.mongodb.net/?retryWrites=true&w=majority`;

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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const addClassCollection = client.db("ShutterbugDb").collection("addClass");
        const selectClassesCollection = client.db("ShutterbugDb").collection("selectClasses");
        // const selectedClassesCollection = client.db("ShutterbugDb").collection("selectClasses");

        const usersCollection = client.db("ShutterbugDb").collection("users");


        // jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ token })
        })


        //
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'Forbidden' });
            }

            next();
        };

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'Forbidden' });
            }

            next();
        };


        // selected class
        app.post('/selectClasses', async (req, res) => {
            const { iName, email, seats, photo, status, name, price } = req.body;

            try {
                const existingSelection = await selectClassesCollection.findOne({ email });

                if (existingSelection) {
                    return res.send({ success: false, message: 'Class already selected .' });
                }

                const result = await selectClassesCollection.insertOne({
                    iName, email, seats, photo, status, name, price
                });

                return res.send({ success: true, data: result });
            } catch (error) {
                console.error('Error occurred while selecting a class:', error);
                return res.status(500).send({ success: false, message: 'Failed to select a class.' });
            }

        })

        // get the data 

        // app.get('/selectedClasses', async (req, res) => {
        //     const { email } = req.query;

        //     try {
        //         const selectedClasses = await selectClassesCollection.find({ email }).toArray();
        //         return res.send({ success: true, data: selectedClasses });
        //     } catch (error) {
        //         console.error('Error occurred while fetching selected classes:', error);
        //         return res.status(500).send({ success: false, message: 'Failed to fetch selected classes.' });
        //     }
        // });


        app.get('/selectedClasses', async (req, res) => {
            const { email } = req.query;
            try {
                const selectedClasses = await selectClassesCollection.find({ email }).toArray();

                return res.send({ success: true, data: selectedClasses });
            }
            catch (error) {
                console.error('Error occurred while fetching selected classes:', error);
                return res.status(500).send({ success: false, message: 'Failed to fetch selected classes.' });
            }
        })





        // app.get('/addClass', async (req, res) => {
        //     const result = await addClassCollection.find().toArray();
        //     const sortedClasses = result.sort((a, b) => b.numberOfStudents - a.numberOfStudents);

        //     res.send(sortedClasses);
        // })
        app.get('/addClass', async (req, res) => {
            try {
                // Retrieve and sort the classes
                const result = await addClassCollection.find().toArray();
                const sortedClasses = result.sort((a, b) => b.numberOfStudents - a.numberOfStudents);

                res.send(sortedClasses);
            } catch (error) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });


        // post addclass
        app.post('/addClass', verifyJWT, async (req, res) => {
            const newItem = req.body;
            const result = await addClassCollection.insertOne(newItem)
            res.send(result);
        })

        //patch class
        app.patch('/addClass/:id', async (req, res) => {
            const id = req.params.id;

            try {
                const updatedClass = await addClassCollection.findOneAndUpdate(
                    { _id: new ObjectId(id) },
                    { $inc: { availableSeats: -1 } },
                    { new: true }
                );
                if (updatedClass) {
                    res.json(updatedClass);
                } else {
                    res.status(404).json({ error: 'Class not founded' });
                }
            } catch (error) {
                res.status(500).json({ error: 'Internal server error' });
            }

            // const updatedClass = await addClassCollection.findOneAndUpdate(
            //     { _id: new ObjectId(id) },
            //     { $inc: { availableSeats: -1 } },
            //     { new: true }
            // );
            // if (updatedClass) {
            //     res.json(updatedClass);
            // } else {
            //     res.status(404).json({ error: 'Class not found' });
            // }
        })

        //post approve class
        app.post('/addClass/approve/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const id = req.params.id;
                const result = await addClassCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'approved' } }
                );

                if (result.modifiedCount > 0) {
                    res.json({ success: true });
                } else {
                    res.json({ success: false });
                }
            } catch (error) {
                console.error('Failed to approve class:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        })

        //post deny 
        app.post('/addClass/deny/:id', async (req, res) => {
            try {
                const id = req.params.id;
                // Update the class in your database with the denied status
                // Example using MongoDB native driver (no Mongoose)
                const result = await addClassCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'denied' } }
                );
                if (result.modifiedCount > 0) {
                    res.json({ success: true });
                } else {
                    res.json({ success: false });
                }
            } catch (error) {
                console.error('Failed to deny class:', error);
                res.status(500).json({ success: false, error: 'Internal server error' });
            }
        })


        // check admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        // check instructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;


            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })



        // users related api's
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            // console.log('existing user',existingUser);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)

        })

        // make admin
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        // make instructor
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor',
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });








        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Summer camp going on....')
})

app.listen(port, () => {
    console.log(`Summer camp Going ${port}`);
})