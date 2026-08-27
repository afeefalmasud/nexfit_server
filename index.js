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

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const database = client.db("nexfit");
    const classCollection = database.collection("class");
    const userCollection = database.collection("user");
    const forumCollection = database.collection("forum");
    const commentsCollection = database.collection("comments");
    const votesCollection = database.collection("votes");

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

    app.delete("/api/forum/:id", async (req, res) => {
      const { id } = req.params;
      const result = await forumCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.get("/api/classes", async (req, res) => {
      try {
        const classes = await classCollection
          .aggregate([
            {
              $addFields: {
                trainerObjectId: { $toObjectId: "$trainerId" },
              },
            },
            {
              $lookup: {
                from: "user",
                localField: "trainerObjectId",
                foreignField: "_id",
                as: "trainerInfo",
              },
            },
            {
              $unwind: {
                path: "$trainerInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $addFields: {
                trainerName: {
                  $ifNull: ["$trainerInfo.name", "Master Trainer"],
                },
              },
            },
            {
              $project: {
                trainerInfo: 0,
                trainerObjectId: 0,
              },
            },
            { $sort: { _id: -1 } },
          ])
          .toArray();

        res.status(200).json(classes);
      } catch (error) {
        console.error("Error fetching classes:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch classes" });
      }
    });

    app.get("/api/forums", async (req, res) => {
      try {
        const posts = await forumCollection
          .aggregate([
            {
              $addFields: {
                authorObjectId: { $toObjectId: "$trainerId" },
              },
            },
            {
              $lookup: {
                from: "user",
                localField: "authorObjectId",
                foreignField: "_id",
                as: "authorInfo",
              },
            },
            {
              $unwind: {
                path: "$authorInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $addFields: {
                authorName: { $ifNull: ["$authorInfo.name", "Anonymous"] },
                role: { $ifNull: ["$authorInfo.role", "Trainer"] },
              },
            },
            {
              $project: {
                authorInfo: 0,
                authorObjectId: 0,
              },
            },
            { $sort: { _id: -1 } },
          ])
          .toArray();

        res.status(200).json(posts);
      } catch (error) {
        console.error("Error fetching forum posts:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch posts" });
      }
    });

    app.get("/api/classes/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid ID format" });
        }

        const result = await classCollection
          .aggregate([
            { $match: { _id: new ObjectId(id) } },
            {
              $addFields: {
                trainerObjectId: {
                  $cond: {
                    if: { $eq: [{ $type: "$trainerId" }, "string"] },
                    then: { $toObjectId: "$trainerId" },
                    else: "$trainerId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "user",
                localField: "trainerObjectId",
                foreignField: "_id",
                as: "trainerInfo",
              },
            },
            {
              $unwind: {
                path: "$trainerInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $addFields: {
                trainerName: {
                  $ifNull: [
                    "$trainerInfo.name",
                    "$trainerInfo.fullName",
                    "$trainerEmail",
                    "Master Trainer",
                  ],
                },
              },
            },
            {
              $project: {
                trainerInfo: 0,
                trainerObjectId: 0,
              },
            },
          ])
          .toArray();

        if (!result || result.length === 0) {
          return res.status(404).json({ message: "Class not found" });
        }

        res.status(200).json(result[0]);
      } catch (error) {
        console.error("Error fetching single class:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/api/forum/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { userId } = req.query;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid ID format" });
        }

        const postId = new ObjectId(id);

        const postWithAuthor = await forumCollection
          .aggregate([
            { $match: { _id: postId } },
            {
              $addFields: {
                authorObjectId: {
                  $cond: {
                    if: { $eq: [{ $type: "$trainerId" }, "string"] },
                    then: { $toObjectId: "$trainerId" },
                    else: "$trainerId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "user",
                localField: "authorObjectId",
                foreignField: "_id",
                as: "authorInfo",
              },
            },
            {
              $unwind: {
                path: "$authorInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $addFields: {
                authorName: {
                  $ifNull: [
                    "$authorInfo.name",
                    "$authorInfo.fullName",
                    "$trainerName",
                    "Anonymous",
                  ],
                },
              },
            },
            {
              $project: {
                authorInfo: 0,
                authorObjectId: 0,
              },
            },
          ])
          .toArray();

        const post = postWithAuthor[0];

        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        const [comments, likeCount, dislikeCount, userVote] = await Promise.all(
          [
            commentsCollection
              .find({ postId: postId })
              .sort({ createdAt: -1 })
              .toArray(),
            votesCollection.countDocuments({ postId: postId, type: "like" }),
            votesCollection.countDocuments({ postId: postId, type: "dislike" }),
            userId ? votesCollection.findOne({ postId, userId }) : null,
          ],
        );

        res.status(200).json({
          ...post,
          comments,
          likeCount,
          dislikeCount,
          userReaction: userVote ? userVote.type : null,
        });
      } catch (err) {
        console.error("Fetch post error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/api/forum/:id/vote", async (req, res) => {
      try {
        const { id } = req.params;
        const { userId, type } = req.body;

        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const postId = new ObjectId(id);

        const existingVote = await votesCollection.findOne({ postId, userId });

        if (existingVote && existingVote.type === type) {
          await votesCollection.deleteOne({ postId, userId });
        } else {
          await votesCollection.updateOne(
            { postId, userId },
            { $set: { type, updatedAt: new Date() } },
            { upsert: true },
          );
        }

        res.status(200).json({ message: "Vote updated" });
      } catch (err) {
        console.error("Vote error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/api/forum/:id/comments", async (req, res) => {
      try {
        const { id } = req.params;
        const { user, text, parentId } = req.body;

        if (!user?.id) return res.status(401).json({ message: "Unauthorized" });
        if (!text?.trim()) {
          return res.status(400).json({ message: "Text required" });
        }

        const newComment = {
          postId: new ObjectId(id),
          parentId: parentId ? new ObjectId(parentId) : null,
          userId: user.id,
          userName: user.name || user.email?.split("@")[0] || "User",
          userEmail: user.email,
          text,
          createdAt: new Date(),
        };

        const result = await commentsCollection.insertOne(newComment);
        res.status(201).json({ ...newComment, _id: result.insertedId });
      } catch (err) {
        console.error("Comment error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/api/forum/:id/comments/:commentId", async (req, res) => {
      try {
        const { commentId } = req.params;
        const { userId, text } = req.body;

        const result = await commentsCollection.updateOne(
          { _id: new ObjectId(commentId), userId },
          { $set: { text, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
          return res.status(403).json({ message: "Unauthorized or not found" });
        }

        res.status(200).json({ message: "Comment updated" });
      } catch (err) {
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/api/forum/:id/comments/:commentId", async (req, res) => {
      try {
        const { commentId } = req.params;
        const { userId } = req.query;

        const targetId = new ObjectId(commentId);

        await commentsCollection.deleteMany({
          $or: [{ _id: targetId, userId }, { parentId: targetId }],
        });

        res.status(200).json({ message: "Comment deleted" });
      } catch (err) {
        res.status(500).json({ message: "Internal server error" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
