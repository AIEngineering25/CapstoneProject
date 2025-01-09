// Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Joi = require('joi'); 

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/civilloan', {
    useNewUrlParser: true,
    useUnifiedTopology: true  
}).then(() => console.log('Connected to MongoDB')).catch(err => console.error('Connection error:', err));

// Define Mongoose Schemas and Models

// Loan service schema (loan types)
const serviceSchema = new mongoose.Schema({
    type: String,          
    description: String,    
    interestRate: Number,  
    maxAmount: Number,      
    tenure: Number,        
    imgUrl: String        
});
const Service = mongoose.model('Service', serviceSchema);

// User loan request schema
const requestSchema = new mongoose.Schema({
    mobile: Number,
    email: String,
    amt: Number,
    type: String,
    msg: String,
    code: String
});
const Request = mongoose.model('Request', requestSchema);

// Member schema for user registration
const memberSchema = new mongoose.Schema({
    mobile: Number,
    email: String,
    occupation: String,
    createpassword: String
});
const Member = mongoose.model('Member', memberSchema);

// Middleware for validation
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
};

// Joi schemas for validation
const requestSchemaValidation = Joi.object({
    mobile: Joi.number().required(),
    email: Joi.string().email().required(),
    amt: Joi.number().required(),
    type: Joi.string().required(),
    msg: Joi.string(),
    code: Joi.string()
});

const memberSchemaValidation = Joi.object({
    mobile: Joi.number().required(),
    email: Joi.string().email().required(),
    occupation: Joi.string().required(),
    createpassword: Joi.string().required()
});

// Define API Routes

// Root route (home page)
app.get('/', (req, res) => {
    res.send('Welcome to the Civil-Finloan API');
});

// 1. Get all available loan types
app.get('/allservices', async (req, res) => {
    try {
        const services = await Service.find();
        if (services.length === 0) {
            return res.status(404).json({ error: 'No loan services available' });
        }
        // Return loan types with basic details
        const briefServices = services.map(service => ({
            type: service.type,
            description: service.description,
            imgUrl: service.imgUrl
        }));
        res.json(briefServices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

// 2. Get specific loan service details by type
app.get('/service/:type', async (req, res) => {
    try {
        const service = await Service.findOne({ type: req.params.type });
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        res.json(service);  
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch service details' });
    }
});

// 3. Apply for a loan enquiry
app.post('/service/:type/form', validate(requestSchemaValidation), async (req, res) => {
    try {
        const newRequest = new Request(req.body);
        await newRequest.save();
        res.status(201).json({ message: 'Loan enquiry submitted successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to submit loan enquiry' });
    }
});

// 4. User registration (new member)
app.post('/member', validate(memberSchemaValidation), async (req, res) => {
    try {
        const newMember = new Member(req.body);
        await newMember.save();
        res.status(201).json({ message: 'Member registered successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to register member' });
    }
});

// 5. Calculate loan interest based on loan type and amount
app.post('/service/:type/calculate', async (req, res) => {
    const { amt, tenure } = req.body;
    const service = await Service.findOne({ type: req.params.type });

    if (!service) {
        return res.status(404).json({ error: 'Loan type not found' });
    }

    if (!amt || !tenure) {
        return res.status(400).json({ error: 'Amount and tenure are required' });
    }

    // Calculate simple interest for loan
    const interest = (amt * service.interestRate * tenure) / 100;
    const totalAmount = amt + interest;
    res.json({ totalAmount, interest, loanAmount: amt, tenure });
});

// 6. Request for money remittance (Post-loan approval)
app.post('/service/:type/remittance', async (req, res) => {
    const { amt, mobile } = req.body;
    if (!amt || !mobile) {
        return res.status(400).json({ error: 'Amount and mobile number are required' });
    }
    
    // Check if user has already applied for loan
    const userRequest = await Request.findOne({ mobile });
    if (!userRequest) {
        return res.status(404).json({ error: 'No loan enquiry found for this mobile number' });
    }

    // Proceed with remittance request
    res.json({ message: `Remittance of ${amt} for loan approved successfully` });
});

// 7. Update a loan request
app.put('/updaterequest', async (req, res) => {
    try {
        const updatedRequest = await Request.findOneAndUpdate(
            { mobile: req.body.mobile },
            req.body,
            { new: true }
        );
        if (updatedRequest) {
            res.json({ message: 'Request updated successfully', updatedRequest });
        } else {
            res.status(404).json({ error: 'Request not found' });
        }
    } catch (error) {
        res.status(400).json({ error: 'Failed to update request' });
    }
});

// 8. Update user password
app.put('/updatepassword', async (req, res) => {
    try {
        const updatedMember = await Member.findOneAndUpdate(
            { mobile: req.body.mobile },
            { createpassword: req.body.password },
            { new: true }
        );
        if (updatedMember) {
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(404).json({ error: 'Member not found' });
        }
    } catch (error) {
        res.status(400).json({ error: 'Failed to update password' });
    }
});

// 9. Delete a loan request
app.delete('/deleterequest', async (req, res) => {
    try {
        const deletedRequest = await Request.findOneAndDelete({ mobile: req.body.mobile });
        if (deletedRequest) {
            res.json({ message: 'Request deleted successfully' });
        } else {
            res.status(404).json({ error: 'Request not found' });
        }
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete request' });
    }
});

// 10. Cancel user membership
app.delete('/cancelmember', async (req, res) => {
    try {
        const deletedMember = await Member.findOneAndDelete({ mobile: req.body.mobile });
        if (deletedMember) {
            res.json({ message: 'Membership cancelled successfully' });
        } else {
            res.status(404).json({ error: 'Member not found' });
        }
    } catch (error) {
        res.status(400).json({ error: 'Failed to cancel membership' });
    }
});

// Export the app
module.exports = app;
