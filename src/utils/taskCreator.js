const taskModel = require('../database/taskModel');
const moment = require('moment');
const fileUtils = require('./fileUtils');

// Simple task creation with just title (and default deadline)
async function addTask(title, userId) {
    try {
        // Use a default deadline of 7 days from now
        const deadline = moment().add(7, 'days').format('YYYY-MM-DD');
        console.log(`Creating task with title: "${title}", deadline: ${deadline}, user ID: ${userId}`);
        
        // Create the task
        const result = await taskModel.createTask(title, deadline, null, userId);
        console.log('Task creation result:', result);
        
        return {
            success: true,
            task: result
        };
    } catch (error) {
        console.error('Error in addTask:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Complete task creation with title, deadline, and optional photo
async function addTaskWithPhoto(title, deadline, photoBuffer, userId) {
    try {
        console.log(`Creating task with title: "${title}", deadline: ${deadline}, photo: ${photoBuffer ? 'yes (buffer length: ' + photoBuffer.length + ')' : 'no'}`);
        
        // Save photo if provided
        let photoPath = null;
        if (photoBuffer && Buffer.isBuffer(photoBuffer)) {
            try {
                photoPath = await fileUtils.saveMedia(photoBuffer, `task_${Date.now()}.jpg`);
                console.log('Photo saved at:', photoPath);
            } catch (photoError) {
                console.error('Error saving photo:', photoError);
                console.error('Photo error stack:', photoError.stack);
                // Continue without photo if there's an error
            }
        } else if (photoBuffer) {
            console.warn('Photo provided is not a valid buffer. Type:', typeof photoBuffer);
            // Try to convert if it's a string
            if (typeof photoBuffer === 'string') {
                try {
                    const buffer = Buffer.from(photoBuffer, 'base64');
                    photoPath = await fileUtils.saveMedia(buffer, `task_${Date.now()}.jpg`);
                    console.log('Converted string to buffer and saved photo at:', photoPath);
                } catch (convErr) {
                    console.error('Error converting string to buffer:', convErr);
                }
            }
        }
        
        // Create the task
        const result = await taskModel.createTask(title, deadline, photoPath, userId);
        console.log('Task creation result:', result);
        
        return {
            success: true,
            task: result,
            hasPhoto: !!photoPath
        };
    } catch (error) {
        console.error('Error in addTaskWithPhoto:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    addTask,
    addTaskWithPhoto
};
