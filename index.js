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
    const bookingsCollection = database.collection("bookings");
    const favoritesCollection = database.collection("favorites");
    const trainerApplicationsCollection= database.collection("application");

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
          status: 'pending',
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
        const { userRole, ...forumData } = req.body;        
        const newForum = {
          ...forumData,
          trainerId: forumData.trainerId,
          status: userRole === 'admin' ? 'approved' : 'pending',
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
              $match: {
                status: "approved"
              }
            },
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
              $match: {
                status: "approved"
              }
            },
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
    // 1. Fetch user bookings or check if booked

    // server.js
    app.get("/api/bookings/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const userBookings = await bookingsCollection
          .aggregate([
            { $match: { userId } },
            {
              $addFields: {
                classObjectId: {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: "$classId",
                        regex: /^[0-9a-fA-F]{24}$/,
                      },
                    },
                    then: { $toObjectId: "$classId" },
                    else: "$classId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "class", // Matches database.collection("class") exactly
                localField: "classObjectId",
                foreignField: "_id",
                as: "classDetails",
              },
            },
            {
              $unwind: {
                path: "$classDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                userId: 1,
                classId: 1,
                price: 1,
                bookedAt: 1,
                className: {
                  $ifNull: [
                    "$classDetails.className",
                    "$className",
                    "$classDetails.name",
                  ],
                },
                trainerName: {
                  $ifNull: [
                    "$classDetails.trainerName",
                    "$classDetails.trainer",
                    "N/A",
                  ],
                },
                schedule: {
                  $ifNull: [
                    "$classDetails.classSchedule",
                    "$classDetails.schedule",
                    "N/A",
                  ],
                },
              },
            },
          ])
          .toArray();

        res.json(userBookings);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
      }
    });
    app.post("/api/bookings/confirm", async (req, res) => {
      try {
        const { userId, classId, className, price } = req.body;

        if (!userId || !classId) {
          return res
            .status(400)
            .json({ success: false, message: "Missing required fields" });
        }

        const result = await bookingsCollection.updateOne(
          { userId, classId },
          {
            $set: {
              userId,
              classId,
              className,
              price: parseFloat(price) || 0,
              bookedAt: new Date(),
            },
          },
          { upsert: true }, // Creates collection & document if it doesn't exist
        );

        console.log("Booking saved to MongoDB:", result);
        return res.json({ success: true, result });
      } catch (err) {
        console.error("Error saving booking:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
    });

    // Check if user already booked
    app.get("/api/bookings/check", async (req, res) => {
      try {
        const { userId, classId } = req.query;
        if (!userId || !classId) return res.json({ isBooked: false });

        const booking = await bookingsCollection.findOne({ userId, classId });
        return res.json({ isBooked: !!booking });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    });
    app.post("/api/favorites/toggle", async (req, res) => {
      try {
        const { userId, classId, className, price } = req.body;
        if (!userId || !classId) {
          return res.status(400).json({ error: "Missing userId or classId" });
        }

        const existing = await favoritesCollection.findOne({ userId, classId });

        if (existing) {
          await favoritesCollection.deleteOne({ userId, classId });
          return res.json({
            isFavorited: false,
            message: "Removed from favorites",
          });
        } else {
          await favoritesCollection.insertOne({
            userId,
            classId,
            className,
            price,
            addedAt: new Date(),
          });
          return res.json({ isFavorited: true, message: "Added to favorites" });
        }
      } catch (error) {
        res.status(500).json({ error: "Failed to toggle favorite" });
      }
    });

    // 2. Check Favorite Status for a user & class
    app.get("/api/favorites/check", async (req, res) => {
      try {
        const { userId, classId } = req.query;
        const existing = await favoritesCollection.findOne({ userId, classId });
        res.json({ isFavorited: Boolean(existing) });
      } catch (error) {
        res.status(500).json({ error: "Failed to check status" });
      }
    });

    // 3. Fetch all User Favorites (For your Member Dashboard Page)
    app.get("/api/favorites/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const favorites = await favoritesCollection
          .aggregate([
            { $match: { userId } },
            {
              $addFields: {
                classObjectId: {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: "$classId",
                        regex: /^[0-9a-fA-F]{24}$/,
                      },
                    },
                    then: { $toObjectId: "$classId" },
                    else: "$classId",
                  },
                },
              },
            },
            {
              $lookup: {
                from: "class",
                localField: "classObjectId",
                foreignField: "_id",
                as: "classDetails",
              },
            },
            {
              $unwind: {
                path: "$classDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                userId: 1,
                classId: 1,
                className: {
                  $ifNull: ["$classDetails.className", "$className"],
                },
                schedule: { $ifNull: ["$classDetails.classSchedule", "N/A"] },
                price: { $ifNull: ["$classDetails.price", "$price"] },
                coverImage: {
                  $ifNull: [
                    "$classDetails.coverImage",
                    "$coverImage",
                    "/images/cardio.jpg",
                  ],
                },
              },
            },
          ])
          .toArray();

        res.json(favorites);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch user favorites" });
      }
    });

    // Admin Overview Stats Endpoint
    app.get("/api/admin/overview-stats", async (req, res) => {
      try {
        const totalUsers = await userCollection.countDocuments();
        const totalClasses = await classCollection.countDocuments();
        const bookedClasses = await bookingsCollection.countDocuments();
        const totalForum = await forumCollection.countDocuments();
        const pendingClasses = await classCollection.countDocuments({
          status: "pending",
        });

        res.json({
          totalUsers,
          totalClasses,
          bookedClasses,
          totalForum,
          usersSubtext: "+412 this month",
          classesSubtext: `${pendingClasses} pending review`,
          bookedSubtext: "+18% MoM",
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch overview stats" });
      }
    });

    // Admin Recent Transactions Endpoint
    app.get("/api/admin/recent-transactions", async (req, res) => {
  try {
    const transactions = await bookingsCollection
      .aggregate([
        { $sort: { bookedAt: -1 } },
        { $limit: 5 },
        // Convert string userId to ObjectId if needed before join
        {
          $addFields: {
            userObjectId: { $toObjectId: "$userId" } 
          }
        },
        {
          $lookup: {
            from: "user", // Name of your users collection in MongoDB
            localField: "userObjectId",
            foreignField: "_id",
            as: "userInfo"
          }
        },
        {
          $unwind: {
            path: "$userInfo",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            price: 1,
            amount: 1,
            bookedAt: 1,
            createdAt: 1,
            // Extract email from joined user document, or fall back to embedded object
            email: { $ifNull: ["$userInfo.email", "$user.email", "N/A"] }
          }
        }
      ])
      .toArray();

    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch recent transactions" });
  }
});

    // Get all users
    app.get("/api/admin/users", async (req, res) => {
      try {
        const users = await userCollection.find({}).toArray();
        res.json(users);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    // Update User Status (Block / Unblock)
    app.patch("/api/admin/users/:id/status", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } },
        );
        res.json({ message: "User status updated successfully" });
      } catch (err) {
        res.status(500).json({ error: "Failed to update user status" });
      }
    });

    app.get("/api/users/me", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Email required" });

        const user = await userCollection.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json(user);
      } catch (err) {
        res.status(500).json({ error: "Server error" });
      }
    });
// 1. Get Trainers Query
app.get('/api/admin/trainers', async (req, res) => {
  try {
    const trainers = await userCollection
      .aggregate([
        { $match: { role: { $in: ['trainer', 'member'] } } },
        {
          $lookup: {
            from: 'class',
            localField: 'email',
            foreignField: 'trainerEmail',
            as: 'trainerClasses'
          }
        },
        {
          $addFields: {
            classIdsAsStrings: {
              $map: {
                input: '$trainerClasses',
                as: 'c',
                in: { $toString: '$$c._id' }
              }
            }
          }
        },
        {
          $lookup: {
            from: 'bookings',
            localField: 'classIdsAsStrings',
            foreignField: 'classId',
            as: 'classBookings'
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            image: 1,
            role: 1, // <--- MUST RETURN ROLE HERE
            classesCount: { $size: '$trainerClasses' },
            studentsCount: { $size: '$classBookings' }
          }
        }
      ])
      .toArray();

    res.json(trainers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trainers' });
  }
});

// 2. Role Toggle Route
app.patch('/api/admin/trainers/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role: role } }
    );

    res.json({ message: `Role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});


// Get all classes for Admin Dashboard
app.get('/api/admin/classes', async (req, res) => {
  try {
    const classes = await classCollection
      .aggregate([
        {
          $addFields: {
            trainerObjectId: { $toObjectId: '$trainerId' },
          },
        },
        {
          $lookup: {
            from: 'user',
            localField: 'trainerObjectId',
            foreignField: '_id',
            as: 'trainerInfo',
          },
        },
        {
          $unwind: {
            path: '$trainerInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            trainerName: {
              $ifNull: ['$trainerInfo.name', 'Master Trainer'],
            },
            trainerEmail: {
              $ifNull: ['$trainerInfo.email', 'N/A'],
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
  } catch (err) {
    console.error('Error fetching admin classes:', err);
    res.status(500).json({ error: 'Failed to fetch classes for admin' });
  }
});

// Admin Approve Action
app.patch('/api/admin/classes/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    await classCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'approved' } }
    );
    res.json({ success: true, message: 'Class approved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve class' });
  }
});

// Admin Reject Action (Deletes the class)
app.delete('/api/admin/classes/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    await classCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: 'Class rejected and deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject class' });
  }
});

// 1. Get all forum posts for Admin (Includes user lookup)
app.get("/api/admin/posts", async (req, res) => {
  try {
    const posts = await forumCollection
      .aggregate([
        {
          $addFields: {
            trainerObjectId: { $toObjectId: '$trainerId' },
          },
        },
        {
          $lookup: {
            from: 'user',
            localField: 'trainerObjectId',
            foreignField: '_id',
            as: 'trainerInfo',
          },
        },
        {
          $unwind: {
            path: '$trainerInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            trainerName: {
              $ifNull: ['$trainerInfo.name', 'Master Trainer'],
            },
            trainerEmail: {
              $ifNull: ['$trainerInfo.email', 'N/A'],
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

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch posts" });
  }
});

// 2. Admin Approve Endpoint (Updates status to 'approved')
app.patch("/api/admin/posts/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    await forumCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "approved" } }
    );
    res.json({ success: true, message: "Post approved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Admin Reject Endpoint (Deletes the post document)
app.delete("/api/admin/posts/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    await forumCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: "Post rejected and removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get('/api/admin/transactions', async (req, res) => {
  try {
    const transactions = await bookingsCollection
          .aggregate([
        { $sort: { bookedAt: 1 } },
        { $limit: 5 },
        {
          $addFields: {
            userObjectId: { $toObjectId: "$userId" } 
          }
        },
        {
          $lookup: {
            from: "user", // Name of your users collection in MongoDB
            localField: "userObjectId",
            foreignField: "_id",
            as: "userInfo"
          }
        },
        {
          $unwind: {
            path: "$userInfo",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            price: 1,
            amount: 1,
            bookedAt: 1,
            createdAt: 1,
            // Extract email from joined user document, or fall back to embedded object
            email: { $ifNull: ["$userInfo.email", "$user.email", "N/A"] }
          }
        }
      ])
      .toArray();

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// POST: Submit a new trainer application
app.post('/api/trainer-applications', async (req, res) => {
  try {
    const { userId, email, fullName, experience, specialty, availableTimes, coachingPhilosophy } = req.body;

    // Check if user already has a pending application
    const existingApp = await trainerApplicationsCollection.findOne({
      $or: [{ userId }, { email }],
      status: 'pending',
    });

    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending trainer application under review.',
      });
    }

    const newApplication = {
      userId,
      fullName,
      email,
      experience: Number(experience),
      specialty,
      availableTimes,
      coachingPhilosophy,
      status: 'pending',
      appliedAt: new Date(),
    };

    const result = await trainerApplicationsCollection.insertOne(newApplication);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('Error submitting trainer application:', error);
    res.status(500).json({ success: false, message: 'Failed to process application' });
  }
});

// 1. GET: Fetch all trainer applications with user data joined
app.get('/api/admin/applied-trainers', async (req, res) => {
  try {
    const applications = await trainerApplicationsCollection
      .aggregate([
        {
          $addFields: {
            userObjectId: {
              $convert: {
                input: '$userId',
                to: 'objectId',
                onError: '$userId',
                onNull: '$userId',
              },
            },
          },
        },
        {
          $lookup: {
            from: 'users', // Check your MongoDB collection name ('users' or 'user')
            localField: 'userObjectId',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $unwind: {
            path: '$userInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            userName: { $ifNull: ['$userInfo.name', '$fullName', '$email'] },
            userEmail: { $ifNull: ['$userInfo.email', '$email'] },
          },
        },
        {
          $project: { userInfo: 0, userObjectId: 0 },
        },
        {
          $sort: { appliedAt: -1 },
        },
      ])
      .toArray();

    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. PATCH: Update Status (Approve/Reject) + Reason + Role Promotion
app.patch('/api/admin/applied-trainers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    // Build base update payload
    const updateDoc = {
      $set: {
        status,
        reviewedAt: new Date(),
      },
    };

    if (status === 'rejected' && rejectionReason) {
      updateDoc.$set.rejectionReason = rejectionReason;
    } else if (status === 'approved') {
      updateDoc.$unset = { rejectionReason: '' };
    }

    // 1. Fetch current application
    const application = await trainerApplicationsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // 2. Update application document
    await trainerApplicationsCollection.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    // 3. If approved, promote user role in `users` collection
    if (status === 'approved') {
      const userFilter = ObjectId.isValid(application.userId)
        ? { _id: new ObjectId(application.userId) }
        : { _id: application.userId };

      await userCollection.updateOne(userFilter, {
        $set: {
          role: 'trainer',
          specialty: application.specialty,
          experience: application.experience,
        },
      });
    }

    res.json({ success: true, message: `Application mark as ${status}` });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const buildUserQuery = (userId, email) => {
  const conditions = [];
  if (userId) {
    conditions.push({ userId: userId });
    if (ObjectId.isValid(userId)) {
      conditions.push({ userId: new ObjectId(userId) });
    }
  }
  if (email) conditions.push({ email: email });
  return conditions.length > 0 ? { $or: conditions } : {};
};

// GET: Dashboard Stats & Trainer Application Status for Member
app.get('/api/member/stats', async (req, res) => {
  try {
    const { userId, email } = req.query;

    const userQuery = buildUserQuery(userId, email);

    // 1. Fetch latest application
    const application = await trainerApplicationsCollection
      .find(userQuery)
      .sort({ appliedAt: -1 })
      .limit(1)
      .toArray();

    // 2. Count Booked Classes & Favorites
    const bookedCount = await bookingsCollection.countDocuments(userQuery);
    const favoritesCount = await favoritesCollection.countDocuments(userQuery);

    res.json({
      success: true,
      bookedCount,
      favoritesCount,
      application: application[0] || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET: Booked Classes for Member
app.get('/api/member/booked-classes', async (req, res) => {
  try {
    const { userId, email } = req.query;
    const userQuery = buildUserQuery(userId, email);

    const bookings = await bookingsCollection.find(userQuery).sort({ bookedAt: -1 }).toArray();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET: Favorite Classes for Member
app.get('/api/member/favorite-classes', async (req, res) => {
  try {
    const { userId, email } = req.query;
    const userQuery = buildUserQuery(userId, email);

    const favorites = await favoritesCollection.find(userQuery).sort({ savedAt: -1 }).toArray();
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
