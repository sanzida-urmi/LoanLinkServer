require("dotenv").config()
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const {Parser} = require('json2csv');
const admin = require("firebase-admin");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const port = process.env.PORT || 3000
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
  'utf-8'
)

const serviceAccount = JSON.parse(decoded)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const app = express()
const cors = require('cors');


// app.use(cors())
// middleware
app.use(
  cors({
      origin: [process.env.CLIENT_DOMAIN],
    credentials: true,
    optionSuccessStatus: 200,
  })
)
app.use(express.json());

// jwt middlewares





// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
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
     const db = client.db('ass')
    const usersCollection = db.collection('users')
    const loanCollection = db.collection('loan')
        const applyLoanCollection = db.collection('applyloan')
             const paymentCollection = db.collection('payment')


            //  mid 
                 // role middlewares
   

     const verifyManager = async (req, res, next) => {
      const email = req.tokenEmail
      const user = await usersCollection.findOne({ email })
      if (user?.role !== 'manager')
        return res
          .status(403)
          .send({ message: 'Manager only Actions!', role: user?.role })

      next()
    }


    //   app.get("/applyloanspending", verifyRole(["manager", "admin", "customer"]), async (req, res) => {
    //   const query = {};
    //   const { status } = req.query;
    //   if (status) {
    //     query.status = status;
    //   }
     
    //   const cursor = applyLoanCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // }); 

    
  //get all apply loan 
       app.get('/applyloanspending', async (req, res) => {
        console.log("ggggggg")
        const query ={}
        const {status} = req.query
        if(status){
          query.status = status
        }
      const result = await applyLoanCollection.find(query).toArray()
      res.send(result)
    })


    app.get("/loan/status-count", async(req,res)=>{
  try {
    const pendingCount = await applyLoanCollection.countDocuments({status: "pending"});
    const approvedCount = await applyLoanCollection.countDocuments({status: "approved"});
    const rejectedCount = await applyLoanCollection.countDocuments({status: "rejected"});
    res.send({
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount
    });
  } catch (error) {
    res.send(500).send({error: "server error"})
  }
});

    app.get("/homeloan", async(req, res)=>{
  const result = await loanCollection.find({showOnHome: true}).limit(6).toArray();

  res.send(result);
})

     //get all loan 
       app.get('/loan', async (req, res) => {
      const result = await loanCollection.find().toArray()
      res.send(result)
    })

    // get single loan by id 

     app.get('/loan/:id', async (req, res) => {
      const id = req.params.id
      const result = await loanCollection.findOne({ _id: new ObjectId(id) })
      res.send(result)
    })

       app.get('/user/role/:email', async(req, res)=>{
          const email= req.params.email;
          const query = {email}
          const user = await usersCollection.findOne(query);
          res.send({role: user?.role || 'borrower'})
        })


          
        // Save a apply loan data in db
    app.post('/applyloan', async (req, res) => {
      const applyLoanData = req.body
      // console.log(plantData)
      const result = await applyLoanCollection.insertOne(applyLoanData)
      res.send(result)
    })
    

       app.get('/user/status/:email', async(req, res)=>{
          const email= req.params.email;
          const query = {email}
          const user = await usersCollection.findOne(query);
          res.send({status: user?.status || 'approve', feedback: user?.feedback})
        })

             app.post("/addLoan", async(req,res) => {
              console.log(req.body);
              try{
                const {title,shortDescription,loanCategory,maxLoanLimit,interest,document,emiPlans,imgURL,showOnHome,createdBy,createdByEmail} = req.body;

                const newLoan ={
                  title,createdBy, shortDescription,loanCategory,createdByEmail,document,interest: Number(interest),
                  maxLoanLimit: Number(maxLoanLimit),
                  emiPlans,imgURL,createdBy,showOnHome,
                  date : new Date().toISOString(),
                }

                // console.log("new", newLoan);
                const result = await loanCollection.insertOne(newLoan);
                res.send({
                  success: true,
                  message: "success",
                  data: result,
                })
              } catch(error){
                res.status(500).send({success: false, error: error.message});
              }
             })

               app.get("/myApplyLoan", async (req, res) => {
      const query = {};
      const { email } = req.query;
      if (email) {
        query.email = email;
      }
           const cursor = applyLoanCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });


 

app.get('/export-applied-loans', async(req,res) =>{
  try{
    const appliedLoans = await applyLoanCollection.find().toArray();
    const csv = new Parser().parse(appliedLoans);
    res.header('Content-type', 'text/csv');
    res.attachment('applied_loans.csv');
    res.send(csv);

  } catch (err) {
    res.status(500).send({error: err.message});
  }
})





             app.get("/users", async (req,res) => {

             const result = await usersCollection.find().toArray()
      res.send(result)

             })


           app.get("/paidmodal/:id", async (req, res) => {
      const id  = req.params.id;
      const query = {loanID : id};
     
      const cursor = paymentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });  

            


     // Payment endpoints
    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo = req.body
      // console.log(paymentInfo)
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                // loanID: paymentInfo?.loanID,
                name: paymentInfo?.title,
                // title: paymentInfo?.title,
                // amount: paymentInfo?.amount,
                // images: [paymentInfo.image],
              },
              unit_amount: 10*100,
            },
            quantity: 1,
          },
        ],
                customer_email: paymentInfo?.borrower?.email,
        // borrower_email: paymentInfo?.borrower?.email,
        mode: 'payment',
        metadata: {
          loanID: paymentInfo?.loanID,
          borrower: paymentInfo?.borrower.email,
          
        },
        success_url: `${process.env.CLIENT_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/dashboard/again/${paymentInfo?.loanID}`,
      })
      res.send({ url: session.url })
    })


      app.post('/payment-success', async (req, res) => {
        console.log("hitttttt")
      const { sessionId } = req.body
      const session = await stripe.checkout.sessions.retrieve(sessionId)

      console.log(sessionId)

      const loan = await applyLoanCollection.findOne({
        _id: new ObjectId(session.metadata.loanID),
      })

      const payment = await paymentCollection.findOne({
        transactionId: session.payment_intent,
      })
      if (session.payment_status === 'paid' && !payment) {
        // save order data in db
        const paymentInfo = {
          loanID: session.metadata.loanID,
          // loanID: session.metadata.loanID,
          transactionId: session.payment_intent,
          borrower: session.metadata.borrower,
          status: 'paid',
          title: loan?.title,
         
        }
        const result = await paymentCollection.insertOne(paymentInfo)
        // update plant quantity
        await applyLoanCollection.updateOne(
          {
            _id: new ObjectId(session.metadata.loanID),
          },
          { $set: {fee: 'paid'} }
        )

        return res.send({
          transactionId: session.payment_intent,
          loanID: result.insertedId,
        })
      }
      res.send(
        res.send({
          transactionId: session.payment_intent,
          loanID: payment._id,
        })
      )
    })


// dlt my loan 
app.delete('/applyloan/:id', async (req,res)=>{
  const {id} = req.params;
  const result = await applyLoanCollection.deleteOne({_id: new ObjectId(id)});
  res.send(result);
})
// dlt one loan 
app.delete('/oneloan/:id', async (req,res)=>{
  const {id} = req.params;
  const result = await loanCollection.deleteOne({_id: new ObjectId(id)});
  // cpy 
      const applyDelete = await applyLoanCollection.deleteMany({ loanID: id });

  res.send(result,applyDelete);
})


     
    // cpy 
    // Update status of an applied loan
// app.patch('/applyloan/status/:id', async (req, res) => {
//   const id = req.params.id;
//   const { status } = req.body; // "approved" বা "rejected"

//   try {
//     const result = await applyLoanCollection.updateOne(
//       { _id: new ObjectId(id) },
//       { $set: { status } }
//     );

//     res.send({
//       success: true,
//       modifiedCount: result.modifiedCount
//     });
//   } catch (error) {
//     console.log(error);
//     res.status(500).send({ success: false, error: error.message });
//   }
// });

app.patch('/applyloan/status/:id', async (req,res)=>{
  const id = req.params.id;
  const {status} = req.body;
  try{
    const updateData = {status}
    if(status === "approved"){
updateData.approved_at = new Date().toISOString();
    }

    const result = await applyLoanCollection.updateOne(
      {
        _id: new ObjectId(id)
      },
      {$set: updateData}
    );
    res.send({
      success: true,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    res.status(500).send({success: false, error: error.message});
  }
});

    

     // user update 
      app.post('/user', async (req,res)=>{
        const userData = req.body
        userData.created_at = new Date().toISOString()
        userData.last_loggedIn = new Date().toISOString()
        userData.role = 'customer'


          const query = {
        email: userData.email,
      }

        const alreadyExists = await usersCollection.findOne(query)
        console.log('user already exist--->', !!alreadyExists)
        if(alreadyExists){
          console.log('updating')
          const result = await usersCollection.updateOne(query, {
            $set: {
              last_loggedIn: new Date().toISOString(),
            },
          })
          return res.send(result);
        }

        console.log("saving new user")
        const result = await usersCollection.insertOne(userData)
        res.send(result);
        
      })

     
    

    

  

     app.get('/allloan', async(req, res)=>{
      console.log("faiza");
          const email= req.query.email;
          const result = await loanCollection.find({createdByEmail: email}).toArray();
          res.send(result)
        })

       

        // update user 
         app.get('/updateuser/:email', async(req, res)=>{
          const email= req.params.email;
          const query = {email}
          const user = await usersCollection.updateOne(query);
          res.send({role: user?.role || 'borrower'})
        })

         app.patch('/updateuser', async (req, res) => {
      const { email, reason,feedback,status } = req.body
      // console.log(email,reason,feedback);
      const result = await usersCollection.updateOne(
        { email },
        { $set: { reason,feedback,status } }
      )

      res.send(result)
    })



app.patch("/loan/show/:id", async(req,res)=>{
  const id = req.params.id;
  const {value} = req.body;
  const result = await loanCollection.updateOne(
    {_id: new ObjectId(id)},
    {$set: {showOnHome: value}}
  );
  res.send(result)
})

// update 
app.patch("/loan/update/:id", async(req,res)=>{
  const id = req.params.id;
  const {updateData} = req.body;

  const result = await loanCollection.updateOne(
    {_id: new ObjectId(id)},
    {$set: {
      Image: updateData.Image,
      title: updateData.title,
      shortDescription: updateData.shortDescription,
      maxLoanLimit: updateData.maxLoanLimit,
      loanCategory: updateData.loanCategory,
      interest: updateData.interest,
      availableEMIPlans: updateData.availableEMIPlans
    }}
  );
  res.send(result)
})






    //  // get a user's role
    // app.get('/user/role/', async (req, res) => {
    //   const result = await usersCollection.findOne({ email: req.tokenEmail })
    //   res.send({ role: result?.role })
    // })

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
  res.send('Hello oo!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
