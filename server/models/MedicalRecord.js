const mongoose = require('mongoose');

const MedicalRecordSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  date: { type: Date, default: Date.now },
  biomarkers: [{
    name: String,
    value: Number,
    unit: String,
    category: String
  }],
  prescriptions: [{
    name: String,
    dosage: String,
    frequency: String,
    type: { type: String },
    description: String,
    alternatives: [{
      name: String,
      type: { type: String },
      description: String
    }]
  }],
  interventions: [{
    category: String,
    title: String,
    description: String,
    impact: String
  }],
  analysis: {
    summary: String,
    risks: [{
      condition: String,
      probability: String,
      reasoning: String,
      forecastHorizon: String
    }],
    preventiveMeasures: [{
      category: String,
      title: String,
      description: String,
      impact: String
    }]
  }
});

module.exports = mongoose.model('MedicalRecord', MedicalRecordSchema);
