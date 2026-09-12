const Machine = require('../models/Machine');

// @desc    Get all machines
// @route   GET /api/machines
// @access  Public
const getAllMachines = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const category = req.query.category;
    const search = req.query.search;
    const status = req.query.status;

    // Build query
    let query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { itemId: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Handle status filter
    if (status && status !== 'all') {
      console.log('Status filter received:', status); // Debug log
      switch (status) {
        case 'in-stock':
          query.quantity = { $gt: 2 }; // Greater than 2 for in-stock
          console.log('Applied in-stock filter'); // Debug log
          break;
        case 'low-stock':
          query.quantity = { $gte: 1, $lte: 2 }; // Between 1 and 2 for low-stock
          console.log('Applied low-stock filter'); // Debug log
          break;
        case 'out-of-stock':
          query.quantity = 0; // Exactly 0 for out-of-stock
          console.log('Applied out-of-stock filter'); // Debug log
          break;
        default:
          console.log('Unknown status filter:', status); // Debug log
      }
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    console.log('Final MongoDB query:', JSON.stringify(query, null, 2)); // Debug log

    // Execute query with pagination
    const machines = await Machine.find(query)
      .sort({ dateAdded: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination info
    const total = await Machine.countDocuments(query);

    res.json({
      success: true,
      count: machines.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: machines
    });
  } catch (error) {
    console.error('Error fetching machines:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get single machine by ID
// @route   GET /api/machines/:id
// @access  Public
const getMachineById = async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id);
    
    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    res.json({
      success: true,
      data: machine
    });
  } catch (error) {
    console.error('Error fetching machine:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Create new machine
// @route   POST /api/machines
// @access  Public
const createMachine = async (req, res) => {
  try {
    let { itemId, name, category, description, price, quantity } = req.body;

    console.log('Received machine data (raw):', { itemId, name, category, description, price, quantity }); // Debug log
    console.log('Category value (raw):', `"${category}"`, 'Length:', category?.length); // Debug log
    
    // Trim all string values and remove any hidden whitespace/control characters
    itemId = itemId?.trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
    name = name?.trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
    category = category?.trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
    description = description?.trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    console.log('After cleaning - Category:', `"${category}"`, 'Length:', category?.length); // Debug log
    
    // Debug: Check for hidden characters
    const validCategories = [
      'Packing Machine',
      'Filling Machine',
      'Sealing Machine',
      'Capping Machine',
      'Date Coding Machine',
      'Dehydrator Machine',
      'Optional Line Equipment',
      'Mixing Machine',
      'Labelling Machine',
      'Grinding Machine',
      'Food machine',
      'Other'
    ];
    
    if (category) {
      console.log('Category char codes:', Array.from(category).map(c => c.charCodeAt(0))); // Debug log
      console.log('Valid categories:', validCategories);
      console.log('Is category valid?', validCategories.includes(category));
      
      // Manual validation before MongoDB
      if (!validCategories.includes(category)) {
        console.error('Category not found in valid list. Exact matches:');
        validCategories.forEach(validCat => {
          console.log(`  "${validCat}" === "${category}": ${validCat === category}`);
        });
        return res.status(400).json({
          success: false,
          message: `Invalid category. Please select from the predefined list.`,
          receivedCategory: category,
          validCategories: validCategories
        });
      }
    }

    // Check if machine with itemId already exists
    const existingMachine = await Machine.findOne({ itemId });
    if (existingMachine) {
      return res.status(400).json({
        success: false,
        message: 'Machine with this Item ID already exists'
      });
    }

    // Create new machine with already-trimmed values
    const machine = new Machine({
      itemId,
      name,
      category,
      description,
      price,
      quantity
    });

    const savedMachine = await machine.save();

    res.status(201).json({
      success: true,
      message: 'Machine added successfully',
      data: savedMachine
    });
  } catch (error) {
    console.error('Error creating machine:', error);
    console.error('Error name:', error.name); // Debug log
    console.error('Error details:', error.errors); // Debug log
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => {
        console.log('Validation error field:', err.path, 'Value:', err.value, 'Message:', err.message); // Debug log
        return `${err.path}: ${err.message}`;
      });
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors,
        details: error.message // Include full error message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update machine
// @route   PUT /api/machines/:id
// @access  Public
const updateMachine = async (req, res) => {
  try {
    const { itemId, name, category, description, price, quantity } = req.body;

    // Check if itemId is being updated and if it already exists
    if (itemId) {
      const existingMachine = await Machine.findOne({ 
        itemId, 
        _id: { $ne: req.params.id } 
      });
      
      if (existingMachine) {
        return res.status(400).json({
          success: false,
          message: 'Machine with this Item ID already exists'
        });
      }
    }

    const machine = await Machine.findByIdAndUpdate(
      req.params.id,
      { itemId, name, category, description, price, quantity },
      { new: true, runValidators: true }
    );

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    res.json({
      success: true,
      message: 'Machine updated successfully',
      data: machine
    });
  } catch (error) {
    console.error('Error updating machine:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete machine
// @route   DELETE /api/machines/:id
// @access  Public
const deleteMachine = async (req, res) => {
  try {
    const machine = await Machine.findByIdAndDelete(req.params.id);

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }

    res.json({
      success: true,
      message: 'Machine deleted successfully',
      data: machine
    });
  } catch (error) {
    console.error('Error deleting machine:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Machine not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get machine categories
// @route   GET /api/machines/categories
// @access  Public
const getMachineCategories = async (req, res) => {
  try {
    const categories = await Machine.distinct('category');
    
    // Get count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Machine.countDocuments({ category });
        return { name: category, count };
      })
    );

    res.json({
      success: true,
      data: categoriesWithCount
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update machine stock (for internal use by sales)
// @route   PATCH /api/machines/:id/stock
// @access  Private (used by sales controller)
const updateMachineStock = async (machineId, quantityToReduce) => {
  try {
    const machine = await Machine.findById(machineId);
    
    if (!machine) {
      throw new Error('Machine not found');
    }
    
    if (machine.quantity < quantityToReduce) {
      throw new Error(`Insufficient stock. Available: ${machine.quantity}, Requested: ${quantityToReduce}`);
    }
    
    machine.quantity -= quantityToReduce;
    await machine.save();
    
    return machine;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getAllMachines,
  getMachineById,
  createMachine,
  updateMachine,
  deleteMachine,
  getMachineCategories,
  updateMachineStock
};