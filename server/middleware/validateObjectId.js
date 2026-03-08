/**
 * validateObjectId middleware
 * Validates MongoDB ObjectId params before hitting the DB.
 * Prevents unnecessary DB queries and leaks info about internal IDs.
 *
 * Usage (single param):
 *   router.get('/:id', validateObjectId(), async (req, res) => { ... });
 *
 * Usage (custom param name):
 *   router.get('/:userId', validateObjectId('userId'), async (req, res) => { ... });
 *
 * Usage (multiple params):
 *   router.get('/:jobId/proposals/:proposalId', validateObjectId('jobId', 'proposalId'), ...);
 */

const mongoose = require('mongoose');

/**
 * Middleware factory — use on individual routes:
 *   router.get('/:id', validateObjectId(), handler)
 *   router.get('/:jobId/:proposalId', validateObjectId('jobId', 'proposalId'), handler)
 */
function validateObjectId(...params) {
  const paramsToCheck = params.length > 0 ? params : ['id'];
  return (req, res, next) => {
    for (const param of paramsToCheck) {
      const value = req.params[param];
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({ error: `Invalid ${param} format`, param });
      }
    }
    next();
  };
}

/**
 * router.param handler — use once per router to cover ALL :id routes:
 *   router.param('id', objectIdParam);
 *   router.param('jobId', objectIdParam);
 */
function objectIdParam(req, res, next, value) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
}

module.exports = validateObjectId;
module.exports.objectIdParam = objectIdParam;
