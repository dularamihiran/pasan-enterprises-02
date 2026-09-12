const express = require('express');
const router = express.Router();
const { MACHINE_CATEGORIES } = require('../constants/categories');
const Machine = require('../models/Machine');

/**
 * @route   GET /api/categories/enums
 * @desc    Get valid machine category enum values
 * @access  Public
 */
router.get('/enums', (req, res) => {
  try {
    // Get enum values from the actual schema to ensure they match
    const schemaEnumValues = Machine.schema.path('category').enumValues;
    
    console.log('Categories Debug Info:');
    console.log('- Constant values:', MACHINE_CATEGORIES);
    console.log('- Schema enum values:', schemaEnumValues);
    console.log('- Match:', JSON.stringify(MACHINE_CATEGORIES) === JSON.stringify(schemaEnumValues));
    
    res.json({
      success: true,
      categories: schemaEnumValues || MACHINE_CATEGORIES,
      source: 'schema',
      count: (schemaEnumValues || MACHINE_CATEGORIES).length
    });
  } catch (error) {
    console.error('Error fetching category enums:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category enums',
      error: error.message
    });
  }
});

module.exports = router;
