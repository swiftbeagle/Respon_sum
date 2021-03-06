const { ObjectId } = require('mongodb');
const express = require('express');
const { body, param } = require('express-validator');

const { instructorDocToResponse } = require('./get-instructors.js');
const { getClasses } = require('./get-classes.js');
const pagination = require('../middleware/pagination.js');
const ordering = require('../middleware/ordering.js');
const validate = require('../middleware/validate.js');

const router = express.Router();

router.post('/', [ 
  body('name').isLength({ min: 1 }),
  body('email').isEmail(),
  body('institution').isLength({ min: 1 }),
  validate,
], (req, res) => {
  req.db.collection('instructors').insertOne({
    name: req.body.name,
    email: req.body.email,
    institution: req.body.institution,
    owned_classes: [],
    class_id_to_performance: {},
    questions: [],
  }, (err, result) => {
    if (err) return result.status(500).json({msg: 'Database Error'});
    res.status(200).json({ id: result.insertedId });
  });
});

// route to get instructor Id
router.get('/:instructorId', [
  param('instructorId').isLength({ min: 1 }),
  validate,
], (req, res) => {
  req.db.collection('instructors').findOne({ _id: ObjectId(req.params.instructorId ) }, (err, result) => {
    if (err) return res.status(500).json({ msg: 'Database Error'});
    if (!result) return res.status(404).json({ msg: 'Not Found' });
    return res.status(200).json(instructorDocToResponse(result));
  });
});

router.put('/:instructorId', [
  param('instructorId').isLength({ min: 1 }),
  body('name').isLength({ min: 1 }),
  body('email').isEmail(),
  body('institution').isLength({ min: 1 }),
  validate,
], (req, res) => {
  req.db.collection('instructors').updateOne({ _id: ObjectId(req.params.instructorId ) }, {
    $set: {
      name: req.body.name,
      email: req.body.email,
      institution: req.body.institution,
    }
  }, (err, result) => {
    if (err) return res.status(500).json({ msg: 'Database Error' });
    if (result.modifiedCount === 0) {
      return res.status(404).json({ msg: 'Instructor Not Updated' });
    }
    res.status(200).json({ msg: 'Instructor Successfully Updated' });
  });
});

router.delete('/:instructorId', [
  param('instructorId').isLength({ min: 1 }),
  validate,
], (req, res) => {
  req.db.collection('instructors').deleteOne({ _id: ObjectId(req.params.instructorId ) }, (err, result) => {
    if (err) return res.status(500).json({ msg: 'Database Error' });
    if (result.deletedCount === 0) return res.status(404).json({ msg: 'Instructor Not Found' });
    res.status(200).json({ msg: 'Instructor Deleted' });
  });
});

router.use('/:instructorId/questions', pagination());
router.use('/:instructorId/questions', ordering(
  ['recency', 'correctPercent', 'incorrectPercent', 'unrespondedPercent'], 'recency'));
router.get('/:instructorId/questions', [
  param('instructorId').isLength({ min: 1 }),
  validate,
], (req, res) => {
  // query questions per instructor
  let cursor = req.db.collection('questions').find({
    instructors: {
      $eq: req.params.instructorId
    }
  }).skip(req.pagination.skip).limit(req.pagination.limit);
  
  let orderDir = req.ordering.order === 'asc' ? 1 : -1;
  let inverseOrderDir = (orderDir === 1) ? -1 : 1;
  
  switch (req.ordering.orderBy) {
    case 'recency':
    default:
      cursor.sort('last_started_timestamp', inverseOrderDir);
      break;
    case 'correctPercent':
      cursor.sort('last_stats.correct_percent', orderDir);
      break;
    case 'incorrectPercent':
      cursor.sort('last_stats.incorrect_percent', orderDir);
      break;
    case 'unrespondedPercent':
      cursor.sort('last_stats.unresponded_percent', orderDir);
      break;
  }
  
  cursor.toArray((err, docs) => {
    if (err) return res.status(500).json({ msg: 'Database Error' });
    
    let responses = [];
    for (let doc of docs) {
      let response = {
        id: doc._id,
        asked: doc.asked,
        timestamps: [],
        stats: [],
        questionType: doc.type,
      };
      
      for (let timestamp of doc.timestamps) {
        response.timestamps.push({
          started: timestamp.started_timestamp,
          stopped: timestamp.stopped_timestamp,
        });
      }
      
      for (let stats of doc.stats) {
        response.stats.push({
          numCorrect: stats.num_correct,
          numIncorrect: stats.num_incorrect,
          numUnresponded: stats.num_unresponded,
        });
      }
      
      if (doc.hasOwnProperty('question_text')) {
        response.questionText = doc.questionText;
      }
      if (doc.hasOwnProperty('correct_answer')) {
        response.correctAnswer = doc.correct_answer;
      }
      
      if (doc.type === 'multiple-choice') {
        response.numAnswers = doc.num_answers;
        if (doc.hasOwnProperty('answer_texts')) {
          response.answerTexts = doc.answer_texts;
        }
      }
      
      responses.push(response);
    }
    
    res.status(200).json(responses);
  });
});

router.use('/:instructorId/classes', pagination());
router.get('/:instructorId/classes', [
  param('instructorId').isLength({ min: 1 }),
  validate,
], getClasses(req => ({ instructors: req.params.instructorId })));

module.exports = router;
