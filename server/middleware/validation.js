const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and cannot exceed 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and cannot exceed 50 characters'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const validateJobPost = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and cannot exceed 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Description is required and cannot exceed 5000 characters'),
  body('category')
    .isIn(['web_development', 'mobile_development', 'design', 'writing', 'marketing', 'data_entry', 'customer_service', 'translation', 'video_editing', 'photography', 'consulting', 'other'])
    .withMessage('Invalid category'),
  body('budget.type')
    .isIn(['fixed', 'hourly'])
    .withMessage('Budget type must be fixed or hourly'),
  body('budget.amount')
    .isFloat({ min: 1 })
    .withMessage('Budget amount must be at least $1'),
  body('duration')
    .isIn(['less_than_1_week', '1_2_weeks', '1_month', '2_3_months', '3_6_months', 'more_than_6_months'])
    .withMessage('Invalid duration'),
  body('experienceLevel')
    .isIn(['entry', 'intermediate', 'expert'])
    .withMessage('Invalid experience level'),
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  body('skills.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each skill must be between 1 and 50 characters'),
  body('subcategory')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Subcategory cannot exceed 100 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),
  body('isRemote')
    .optional()
    .isBoolean()
    .withMessage('isRemote must be a boolean'),
  body('isUrgent')
    .optional()
    .isBoolean()
    .withMessage('isUrgent must be a boolean'),
  handleValidationErrors
];

const validateMessage = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content is required and cannot exceed 2000 characters'),
  body('recipientId')
    .optional()
    .isMongoId()
    .withMessage('Invalid recipient ID'),
  body('jobId')
    .optional()
    .isMongoId()
    .withMessage('Invalid job ID'),
  handleValidationErrors
];

const validateProposal = [
  body('coverLetter')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Cover letter is required and cannot exceed 2000 characters'),
  body('proposedBudget')
    .isFloat({ min: 1 })
    .withMessage('Proposed budget must be at least $1'),
  body('proposedDuration')
    .notEmpty()
    .trim()
    .withMessage('Proposed duration is required'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  handleValidationErrors
];

const validateUserSuspension = [
  body('reason')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Suspension reason is required and cannot exceed 500 characters'),
  handleValidationErrors
];

const validateReviewModeration = [
  body('status')
    .isIn(['approved', 'rejected', 'hidden'])
    .withMessage('Invalid moderation status'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  handleValidationErrors
];

const validateQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query cannot exceed 200 characters'),
  query('status')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Status filter cannot exceed 50 characters'),
  query('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category filter cannot exceed 50 characters'),
  query('sortBy')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Sort field cannot exceed 50 characters'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  query('minBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum budget must be a positive number'),
  query('maxBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum budget must be a positive number'),
  handleValidationErrors
];

const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

const validateUserIdParam = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  handleValidationErrors
];

const validateJobIdParam = [
  param('jobId')
    .isMongoId()
    .withMessage('Invalid job ID format'),
  handleValidationErrors
];

const validateReviewIdParam = [
  param('reviewId')
    .isMongoId()
    .withMessage('Invalid review ID format'),
  handleValidationErrors
];

const validateConversationIdParam = [
  param('conversationId')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateJobPost,
  validateMessage,
  validateProposal,
  validateUserSuspension,
  validateReviewModeration,
  validateQueryParams,
  validateMongoId,
  validateUserIdParam,
  validateJobIdParam,
  validateReviewIdParam,
  validateConversationIdParam
};
