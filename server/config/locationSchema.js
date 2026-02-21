/**
 * Reusable location sub-schema for Services, Jobs, and Users
 * Supports remote, local, and hybrid work types with geospatial queries
 */

const locationSchema = {
  locationType: {
    type: String,
    enum: ['remote', 'local', 'hybrid'],
    default: 'remote'
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  state: {
    type: String,
    trim: true,
    default: ''
  },
  zipCode: {
    type: String,
    trim: true,
    default: ''
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],  // [longitude, latitude]
      default: [0, 0]
    }
  },
  serviceRadius: {
    type: Number,
    default: 25,
    min: [1, 'Service radius must be at least 1 mile'],
    max: [500, 'Service radius cannot exceed 500 miles']
  }
};

module.exports = { locationSchema };
