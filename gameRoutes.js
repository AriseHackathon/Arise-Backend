const express = require("express")
const database = require("./connect")
const {ObjectId} = require("mongodb")
const jwt = require('jsonwebtoken')
require("dotenv").config({path: "./config.env"})

let gameRoutes = express.Router()

gameRoutes.route("/games").get(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      let query = {}
      
      if (request.query.status) {
         query.status = request.query.status
      }
      
      if (request.query.location) {
         query.location = request.query.location
      }
      
      if (request.query.search) {
         query.$or = [
            { title: { $regex: request.query.search, $options: 'i' } },
            { location: { $regex: request.query.search, $options: 'i' } }
         ]
      }
      
      let data = await db.collection("games").find(query).toArray()
      
      if (data.length > 0) {
         response.json(data)
      } else {
         response.json([]) 
      }
   } catch (error) {
      response.status(500).json({ message: "Error fetching games", error: error.message })
   }
})

gameRoutes.route("/games/status/:status").get(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      let status = request.params.status
      
      let data = await db.collection("games").find({ status: status }).toArray()
      
      response.json(data)
   } catch (error) {
      response.status(500).json({ message: "Error fetching games by status", error: error.message })
   }
})

gameRoutes.route("/games/stats/overview").get(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      
      let stats = await db.collection("games").aggregate([
         {
            $group: {
               _id: "$status",
               count: { $sum: 1 }
            }
         }
      ]).toArray()
      
      let overview = {
         ongoing: 0,
         upcoming: 0,
         past: 0,
         total: 0
      }
      
      stats.forEach(stat => {
         overview[stat._id] = stat.count
         overview.total += stat.count
      })
      
      response.json(overview)
   } catch (error) {
      response.status(500).json({ message: "Error fetching statistics", error: error.message })
   }
})

gameRoutes.route("/games/:id").get(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      let data = await db.collection("games").findOne({ _id: new ObjectId(request.params.id) })

      if (data) {
         response.json(data)
      } else {
         response.status(404).json({ message: "Game not found" })
      }
   } catch (error) {
      response.status(500).json({ message: "Error fetching game", error: error.message })
   }
})

gameRoutes.route("/games").post(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      let mongoObject = {
         title: request.body.title,
         location: request.body.location,
         date: request.body.date,
         fee: request.body.fee,
         status: request.body.status || 'upcoming',
         icon: request.body.icon || 'gamepad',
         description: request.body.description,
         maxParticipants: request.body.maxParticipants || 20,
         currentParticipants: request.body.currentParticipants || 0,
         participants: request.body.participants || [],
         // Remove the organizer field for now since authentication isn't working
         // organizer: request.body.user.userId,
         createdAt: new Date(),
         updatedAt: new Date()
      }
      
      let data = await db.collection("games").insertOne(mongoObject)
      response.json(data)
   } catch (error) {
      response.status(500).json({ message: "Error creating game", error: error.message })
   }
})

gameRoutes.route("/games/:id").put(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      let mongoObject = {
         $set: {
            title: request.body.title,
            location: request.body.location,
            date: request.body.date,
            fee: request.body.fee,
            status: request.body.status,
            icon: request.body.icon,
            description: request.body.description,
            maxParticipants: request.body.maxParticipants,
            currentParticipants: request.body.currentParticipants,
            participants: request.body.participants,
            updatedAt: new Date()
         }
      }
      
      let data = await db.collection("games").updateOne(
         { _id: new ObjectId(request.params.id) }, 
         mongoObject
      )
      
      response.json(data)
   } catch (error) {
      response.status(500).json({ message: "Error updating game", error: error.message })
   }
})

gameRoutes.route("/games/:id/join").post(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      let gameId = new ObjectId(request.params.id)
      let userId = request.body.user?.userId || 'anonymous'
      let userName = request.body.user?.username || request.body.user?.email || 'Anonymous User'
      
      let game = await db.collection("games").findOne({ _id: gameId })
      
      if (!game) {
         return response.status(404).json({ message: "Game not found" })
      }
      
      if (game.participants && game.participants.some(p => p.userId === userId)) {
         return response.status(400).json({ message: "Already joined this game" })
      }
      
      if (game.currentParticipants >= game.maxParticipants) {
         return response.status(400).json({ message: "Game is full" })
      }
      
      let updateResult = await db.collection("games").updateOne(
         { _id: gameId },
         {
            $push: { participants: { userId: userId, userName: userName, joinedAt: new Date() } },
            $inc: { currentParticipants: 1 },
            $set: { updatedAt: new Date() }
         }
      )
      
      response.json({ message: "Successfully joined the game", result: updateResult })
   } catch (error) {
      response.status(500).json({ message: "Error joining game", error: error.message })
   }
})

gameRoutes.route("/games/:id/leave").post(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      let gameId = new ObjectId(request.params.id)
      let userId = request.body.user?.userId || 'anonymous'
      
      let updateResult = await db.collection("games").updateOne(
         { _id: gameId },
         {
            $pull: { participants: { userId: userId } },
            $inc: { currentParticipants: -1 },
            $set: { updatedAt: new Date() }
         }
      )
      
      response.json({ message: "Successfully left the game", result: updateResult })
   } catch (error) {
      response.status(500).json({ message: "Error leaving game", error: error.message })
   }
})

gameRoutes.route("/games/:id").delete(verifyToken, async (request, response) => {
   try {
      let db = database.getDb()
      let data = await db.collection("games").deleteOne({ _id: new ObjectId(request.params.id) })
      
      response.json(data)
   } catch (error) {
      response.status(500).json({ message: "Error deleting game", error: error.message })
   }
})

function verifyToken(request, response, next) {
   const authHeaders = request.headers["authorization"]
   const token = authHeaders && authHeaders.split(" ")[1]

   if (!token) {
      return response.status(401).json({message: "Authentication token is missing"})
   }
   
   jwt.verify(token, process.env.SECRETKEY, (error, user) => {
      if (error) {
         return response.status(403).json({message: "Invalid token"})
      }
      request.body.user = user
      next()
   })
}

gameRoutes.route("/verify-token").get(verifyToken, async (request, response) => {
    response.json({ 
        valid: true, 
        user: request.body.user 
    });
});

module.exports = gameRoutes
