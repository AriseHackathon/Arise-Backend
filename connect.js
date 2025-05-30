
const { MongoClient, ServerApiVersion } = require('mongodb');

require("dotenv").config({path: "./config.env"})


const client = new MongoClient(process.env.ATLAS_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let database

module.exports = {
 connectToServer: async () => {
  await client.connect(); 
  database = client.db("ariseData")
},
 getDb: () => {
  return database
 }

}



