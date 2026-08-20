const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const database = client.db("nexfit");
    const classCollection = database.collection("class");
    const userCollection = database.collection("user");
    const forumCollection = database.collection("forum");

    app.get("/api/user", async (req, res) => {
      try {
        const { email, id } = req.query;
        let query = {};

        if (email) {
          query = { email };
        } else if (id) {
          query = { _id: new ObjectId(id) };
        } else {
          return res
            .status(400)
            .json({ success: false, message: "Email or ID is required" });
        }

        const user = await userCollection.findOne(query);

        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }

        res.json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role || "member",
            image: user.image,
          },
        });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // class get and post
    app.post("/api/class", async (req, res) => {
      try {
        const classData = req.body;

        const newClass = {
          ...classData,
          trainerId: classData.trainerId,
          status: classData.status || "approved",
          createdAt: new Date(),
        };

        const result = await classCollection.insertOne(newClass);
        res.status(201).json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    app.get("/api/class", async (req, res) => {
      try {
        const { trainerId, status } = req.query;
        let query = {};

        if (trainerId) {
          query.$or = [{ trainerId: trainerId }, { trainerEmail: trainerId }];
        }

        if (status) {
          query.status = status;
        }

        const classes = await classCollection.find(query).toArray();
        res.json(classes);
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // forum get and post
    app.post("/api/forum", async (req, res) => {
      try {
        const forumData = req.body;
        const newForum = {
          ...forumData,
          trainerId: forumData.trainerId,
          status: forumData.status || "approved",
          createdAt: new Date(),
        };
        const result = await forumCollection.insertOne(newForum);
        res.status(201).json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    app.get("/api/forum", async (req, res) => {
      try {
        const { trainerId, status } = req.query;
        let query = {};

        if (trainerId) {
          query.$or = [{ trainerId: trainerId }, { trainerEmail: trainerId }];
        }

        if (status) {
          query.status = status;
        }

        const forumPosts = await forumCollection.find(query).toArray();
        res.json(forumPosts);
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    app.delete("/api/forum/:id", async(req,res)=>{
      const {id} = req.params;
      const result = await forumCollection.deleteOne({_id: new ObjectId(id)});
      res.json(result);
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
