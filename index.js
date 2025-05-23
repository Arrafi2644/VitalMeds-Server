require('dotenv').config()
const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
// const stripe = require('stripe')(process.env.STIPE_SECRET_KEY);
const stripe = require('stripe')('sk_test_51QlYOnJHnPc6ZjSUD3WkVgCN2LzBkEFoJRREA0kGd3LRu6saSNL3zcTU95TEXbPW83SJLfzbt3GbIrCMnVuiqPPM00aewStDJF');

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.duk9d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const userCollection = client.db("VitalMeds").collection("Users");
    const medicineCollection = client.db("VitalMeds").collection("medicines");
    const cartCollection = client.db("VitalMeds").collection("carts");
    const categoryCollection = client.db("VitalMeds").collection("categories");
    const advertisementCollection = client.db("VitalMeds").collection("advertisements");
    const postedAdvertiseCollection = client.db("VitalMeds").collection("postedAdvertises");
    const paymentCollection = client.db("VitalMeds").collection("payments");
    const salesCollection = client.db("VitalMeds").collection("sales");
    const orderCollection = client.db("VitalMeds").collection("orders");


    // verify token middleware 
    const verifyToken = (req, res, next) => {
      console.log("Inside the verify middleware ", req.headers.authorization);

      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }

      const token = req.headers.authorization.split(" ")[1];
      console.log("Token is ", token);

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (error, decoded) {
        if (error) {
          return res.status(401).send({ message: "unauthorized access" })
        }
        req.decoded = decoded;
        next();
      })

    }

    // verify admin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query)
      if (user.role !== 'admin') {
        return res.status(403).send({ message: "forbidden access" })
      }
      next()
    }

    // jwt related api 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' })
      res.send({ token })
    })

    // users related api 

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers.authorization);
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send({ message: 'already-exist' });
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    // admin 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)

      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "admin";
      }
      res.send(isAdmin)
    })

    app.patch('/users', async (req, res) => {
      const user = req.body;
      const id = user._id;
      const filter = { _id: new ObjectId(id) }
      console.log("user", user);
      const updatedDoc = {
        $set: {
          role: user.toRole
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    // is seller 
    app.get('/users/seller/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query)
      let isSeller = false;

      if (user) {
        isSeller = user?.role === "seller";
      }

      res.send(isSeller)
    })


    // medicines related api

    app.get('/medicines', async (req, res) => {
      const category = req.query.category || "";
      const search = req.query.search || "";
      const sort = req.query.sort || "";

      console.log("category", category);
      console.log("sort", sort);
      console.log("search", search);

      let query = {};

      const andConditions = [];

      // Search filter
      if (search) {
        andConditions.push({
          $or: [
            { name: { $regex: search, $options: "i" } },
            { genericName: { $regex: search, $options: "i" } },
          ]
        });
      }

      // Category filter
      if (category) {
        andConditions.push({
          category: { $regex: category, $options: "i" }
        });
      }

      // Build final query
      if (andConditions.length > 0) {
        query = { $and: andConditions };
      }

      // Find and sort
      let cursor = medicineCollection.find(query);

      if (sort === "asc") {
        cursor = cursor.sort({ price: 1 });
      } else if (sort === "desc") {
        cursor = cursor.sort({ price: -1 });
      }

      const result = await cursor.toArray();
      res.send(result);
    });


    app.post('/medicines', async (req, res) => {
      const medicine = req.body;
      const result = await medicineCollection.insertOne(medicine)
      res.send(result)
    })

    app.get('/medicines/:email', async (req, res) => {
      const email = req.params.email;
      // console.log("email is ", email);
      const query = { sellerEmail: email }
      // console.log(query);

      const result = await medicineCollection.find(query).toArray();
      res.send(result)
    })

    app.delete('/medicines/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await medicineCollection.deleteOne(query)
      res.send(result)
    })

    //  advertisements related api 

    app.get('/advertisements', async (req, res) => {
      const result = await advertisementCollection.find().toArray();
      res.send(result);
    })

    app.get('/advertisements/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await advertisementCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/advertisements', async (req, res) => {
      const advertise = req.body;
      const result = await advertisementCollection.insertOne(advertise)
      res.send(result);
    })

    app.patch('/advertisements', async (req, res) => {
      const advertise = req.body;
      const id = advertise.advertiseId;
      console.log(id);
      const filter = { _id: new ObjectId(id) }
      console.log("Advertise ", advertise);
      const updatedDoc = {
        $set: {
          status: advertise.changeStatus
        }
      }
      const result = await advertisementCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })

    app.patch(`/advertisements/:id`, async (req, res) => {
      const advertiseInfo = req.body;
      console.log(advertiseInfo);

      const id = advertiseInfo._id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          isActivated: advertiseInfo.isActivated,
        }
      }
      const result = await advertisementCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })

    app.delete('/advertisements/:id', async (req, res) => {
      const id = req.params.id;
      console.log("delete id ", id);
      const query = { _id: new ObjectId(id) }
      console.log(query);
      const result = await advertisementCollection.deleteOne(query)
      res.send(result)
    })


    // posted advertisements 

    app.get('/postedAdvertisements', async (req, res) => {
      const result = await postedAdvertiseCollection.find().toArray()
      res.send(result)
    })

    app.post('/postedAdvertisements', async (req, res) => {
      const advertise = req.body;
      const result = await postedAdvertiseCollection.insertOne(advertise);
      res.send(result)
    });

    app.delete('/postedAdvertisements/:id', async (req, res) => {
      const id = req.params.id;
      console.log("delete id ", id);
      const query = { advertiseId: id }
      console.log(query);
      const result = await postedAdvertiseCollection.deleteOne(query)
      res.send(result)
    })

    //  Cart related api 

    app.post('/carts', async (req, res) => {
      const medicine = req.body;
      const result = await cartCollection.insertOne(medicine)
      res.send(result)
    })

    app.get('/carts/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/carts/totalPrice/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };

      const result = await cartCollection.aggregate([
        {
          $match: query
        },
        {
          $project: {
            totalPrice: { $multiply: ["$price", "$quantity"] }
          }
        },
        {
          $group: {
            _id: null,
            grandTotal: { $sum: "$totalPrice" }
          }
        }
      ]).toArray();

      res.send(result)
    });

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      console.log("cart delete id ", id);
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })

    app.delete('/carts/clearAll/:email', async (req, res) => {
      const email = req.params.email;
      console.log("delete all cart for ", email);
      const query = {
        userEmail: {
          $regex: email
        }
      }

      const result = await cartCollection.deleteMany(query)
      res.send(result)
    })

    app.patch('/carts/increment/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $inc: {
          quantity: 1
        }
      }

      const result = await cartCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })

    app.patch('/carts/decrement/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $inc: {
          quantity: -1
        }
      }

      const result = await cartCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })

    // Order related Api 

    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "cart.userEmail": email }
      const result = await orderCollection.find(query).toArray()
      res.send(result)
    })
    app.post("/orders", async (req, res) => {
      const order = req.body;
      console.log("2025 order is ", order);
      const result = await orderCollection.insertOne(order)
      res.send(result)
    })

    // seller 
    app.get('/orders/seller/:email', async (req, res) => {
      const email = req.params.email;
      const query = { "cart.sellerEmail": email };
      const result = await orderCollection.find(query).toArray()
      res.send(result)
    })

    // change order status 
    app.patch('/orders/:id', async (req, res) => {
      const id = req.params.id;
      const updatedStatus = req.body;
      console.log("updated status ", updatedStatus);
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: updatedStatus?.newStatus
        }
      }

      const result = await orderCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })

    // Category related api
    app.get('/categories', async (req, res) => {
      const result = await categoryCollection.find().toArray()
      res.send(result)
    })

    app.post('/categories', async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category)
      res.send(result)
    })

    app.delete('/categories/:id', async (req, res) => {
      const id = req.params.id;
      console.log("delete id", id);
      const query = { _id: new ObjectId(id) }
      const result = await categoryCollection.deleteOne(query)
      res.send(result)
    })


    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      console.log("Payment intent is ", paymentIntent);

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    // payments related api 

    app.get('/payments/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    })

    app.patch('/payments/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: "paid"
        }
      }

      const result = await paymentCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.get('/payments/adminHome/:email', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: "$status",
            totalPrice: {
              $sum: "$price"
            }
          }
        }
      ]).toArray()


      res.send(result)

    })

    // sellerPaymentHistory
    app.get('/payments/seller/:email', verifyToken, async (req, res) => {
      const query = { "products.sellerEmail": req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })


    // sales api 
    app.get('/sales', async (req, res) => {
      const result = await salesCollection.find().toArray()
      res.send(result)
    })
    app.get('/sales/:email', async (req, res) => {
      const email = req.params.email;
      const query = { sellerEmail: email }
      const result = await salesCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/sales', async (req, res) => {
      const products = req.body;
      console.log("new order ", products);
      let result;

      if (Array.isArray(products)) {
        // Multiple products
        result = await salesCollection.insertMany(products);
      } else {
        // Single product
        result = await salesCollection.insertOne(products);
      }

      res.send(result)
    })
    //seller total sales api 

    app.get('/payments/totalSales/:email', async (req, res) => {
      const email = req.params.email;
      const query = { "products.sellerEmail": email };

      const result = await cartCollection.aggregate([
        {
          $match: query
        },
        {
          $project: {
            totalPrice: { $multiply: ["$price", "$quantity"] }
          }
        },
        {
          $group: {
            _id: null,
            grandTotal: { $sum: "$totalPrice" }
          }
        }
      ]).toArray();

      res.send(result)
    })


    app.get('/payments/seller/summary/:email', verifyToken, async (req, res) => {
      const sellerEmail = req.params.email;

      // Check if the authenticated user is the same as the requested seller
      if (sellerEmail !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const result = await paymentCollection.aggregate([
        {
          $unwind: "$products" // Flatten the products array
        },
        {
          $match: { "products.sellerEmail": sellerEmail } // Filter by seller's email
        },
        {
          $group: {
            _id: "$status", // Group by status (paid/pending)
            totalAmount: { $sum: { $multiply: ["$products.price", "$products.quantity"] } }
          }
        }
      ]).toArray();

      // Format the response
      const summary = {
        totalPaid: 0,
        totalPending: 0
      };

      result.forEach(entry => {
        if (entry._id === "paid") {
          summary.totalPaid = entry.totalAmount;
        } else if (entry._id === "pending") {
          summary.totalPending = entry.totalAmount;
        }
      });

      res.send({ sellerEmail, ...summary });

    });

    // orders related api 
    app.get('/sales/myOrders/:email', async (req, res) => {
      const email = req.params.email;
      console.log("user email is ", email);
      const query = { userEmail: email }
      const result = await salesCollection.find(query).toArray()
      res.send(result)
    })


    app.get('/state', async (req, res) => {
      const totalUser = await userCollection.estimatedDocumentCount();
      const totalOrderDelivered = await paymentCollection.estimatedDocumentCount()
      const totalMedicines = await medicineCollection.estimatedDocumentCount()


      res.send({ totalUser, totalOrderDelivered, totalMedicines })
    })

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
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
  res.send("VitalMeds is running")
})

app.listen(port, () => {
  console.log("VitalMeds is running on port ", port);
})






