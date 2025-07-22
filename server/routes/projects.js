const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Job = require('../models/Job');
const ProjectMilestone = require('../models/ProjectMilestone');
const Task = require('../models/Task');
const CalendarEvent = require('../models/Calendar');

router.get('/job/:jobId/timeline', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId).populate('client', 'profile email');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const milestones = await ProjectMilestone.find({ jobId })
      .populate('assignedTo', 'profile email')
      .populate('completedBy', 'profile email')
      .sort({ dueDate: 1 });

    const tasks = await Task.find({ jobId })
      .populate('assignedTo', 'profile email')
      .populate('milestoneId', 'title')
      .sort({ createdAt: 1 });

    const events = await CalendarEvent.find({ relatedJob: jobId })
      .populate('createdBy', 'profile email')
      .sort({ startDate: 1 });

    res.json({
      job,
      milestones,
      tasks,
      events,
      progress: {
        totalMilestones: milestones.length,
        completedMilestones: milestones.filter(m => m.status === 'completed').length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        overallProgress: milestones.length > 0 
          ? Math.round((milestones.filter(m => m.status === 'completed').length / milestones.length) * 100)
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/job/:jobId/milestones', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { title, description, dueDate, priority, assignedTo } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const milestone = new ProjectMilestone({
      jobId,
      title,
      description,
      dueDate,
      priority,
      assignedTo
    });

    await milestone.save();
    await milestone.populate('assignedTo', 'profile email');

    const calendarEvent = new CalendarEvent({
      title: `Milestone: ${title}`,
      description: description,
      startDate: dueDate,
      endDate: dueDate,
      allDay: true,
      type: 'milestone',
      relatedJob: jobId,
      relatedMilestone: milestone._id,
      createdBy: req.user.userId,
      participants: assignedTo ? [{ user: assignedTo }] : []
    });

    await calendarEvent.save();

    res.status(201).json(milestone);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/milestones/:milestoneId', auth, async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const updates = req.body;

    if (updates.status === 'completed' && !updates.completedAt) {
      updates.completedAt = new Date();
      updates.completedBy = req.user.userId;
    }

    const milestone = await ProjectMilestone.findByIdAndUpdate(
      milestoneId,
      updates,
      { new: true }
    ).populate('assignedTo', 'profile email').populate('completedBy', 'profile email');

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    res.json(milestone);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/job/:jobId/tasks', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { title, description, milestoneId, priority, assignedTo, estimatedHours, dueDate, tags } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const task = new Task({
      jobId,
      milestoneId,
      title,
      description,
      priority,
      assignedTo,
      estimatedHours,
      dueDate,
      tags
    });

    await task.save();
    await task.populate('assignedTo', 'profile email').populate('milestoneId', 'title');

    if (dueDate) {
      const calendarEvent = new CalendarEvent({
        title: `Task: ${title}`,
        description: description,
        startDate: dueDate,
        endDate: dueDate,
        allDay: true,
        type: 'task',
        relatedJob: jobId,
        relatedTask: task._id,
        createdBy: req.user.userId,
        participants: assignedTo ? [{ user: assignedTo }] : []
      });

      await calendarEvent.save();
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/tasks/:taskId', auth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    if (updates.status === 'completed' && !updates.completedAt) {
      updates.completedAt = new Date();
    }

    const task = await Task.findByIdAndUpdate(
      taskId,
      updates,
      { new: true }
    ).populate('assignedTo', 'profile email').populate('milestoneId', 'title');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/calendar', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const query = {
      $or: [
        { 'participants.user': req.user.userId },
        { createdBy: req.user.userId }
      ]
    };

    if (start && end) {
      query.startDate = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }

    const events = await CalendarEvent.find(query)
      .populate('relatedJob', 'title')
      .populate('relatedMilestone', 'title')
      .populate('relatedTask', 'title')
      .populate('createdBy', 'profile email')
      .sort({ startDate: 1 });

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/calendar/events', auth, async (req, res) => {
  try {
    const { title, description, startDate, endDate, allDay, type, relatedJob, participants } = req.body;

    const event = new CalendarEvent({
      title,
      description,
      startDate,
      endDate,
      allDay,
      type,
      relatedJob,
      participants: participants || [],
      createdBy: req.user.userId
    });

    await event.save();
    await event.populate('relatedJob', 'title').populate('createdBy', 'profile email');

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userJobs = await Job.find({
      $or: [
        { client: userId },
        { 'applications.freelancer': userId, 'applications.status': 'accepted' }
      ]
    });

    const jobIds = userJobs.map(job => job._id);

    const [
      upcomingMilestones,
      overdueTasks,
      todayEvents,
      recentActivity
    ] = await Promise.all([
      ProjectMilestone.find({
        jobId: { $in: jobIds },
        status: { $in: ['pending', 'in-progress'] },
        dueDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
      }).populate('jobId', 'title').sort({ dueDate: 1 }).limit(5),

      Task.find({
        jobId: { $in: jobIds },
        status: { $ne: 'completed' },
        dueDate: { $lt: new Date() }
      }).populate('jobId', 'title').sort({ dueDate: 1 }).limit(5),

      CalendarEvent.find({
        $or: [
          { 'participants.user': userId },
          { createdBy: userId }
        ],
        startDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }).populate('relatedJob', 'title').sort({ startDate: 1 }),

      Task.find({
        jobId: { $in: jobIds }
      }).sort({ updatedAt: -1 }).limit(10).populate('jobId', 'title').populate('assignedTo', 'profile email')
    ]);

    res.json({
      upcomingMilestones,
      overdueTasks,
      todayEvents,
      recentActivity,
      stats: {
        totalJobs: userJobs.length,
        activeJobs: userJobs.filter(job => job.status === 'in-progress').length,
        upcomingDeadlines: upcomingMilestones.length,
        overdueItems: overdueTasks.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
