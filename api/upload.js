const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

// Upload contacts CSV
router.post('/contacts', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No file uploaded' 
            });
        }

        const contacts = [];
        const buffer = req.file.buffer;
        const readableStream = Readable.from(buffer.toString());

        readableStream
            .pipe(csv())
            .on('data', (data) => {
                if (data.phone) {
                    // Basic phone validation
                    const cleanPhone = data.phone.replace(/\D/g, '');
                    if (cleanPhone.startsWith('62') && cleanPhone.length >= 10) {
                        contacts.push({
                            phone: cleanPhone,
                            name: data.name || '',
                            company: data.company || ''
                        });
                    }
                }
            })
            .on('end', () => {
                if (contacts.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No valid contacts found in CSV file'
                    });
                }

                res.json({ 
                    success: true, 
                    contacts,
                    message: `Successfully processed ${contacts.length} contacts`
                });
            })
            .on('error', (error) => {
                console.error('CSV processing error:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error processing CSV file: ' + error.message 
                });
            });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;
