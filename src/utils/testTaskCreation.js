// Test script for task creation
const taskCreator = require('./taskCreator');

async function testTaskCreation() {
    console.log('Starting test task creation...');
    
    try {
        const result = await taskCreator.addTask('Test Task from Utility', 3);
        console.log('Task creation result:', result);
        
        if (result.success) {
            console.log('Task created successfully!');
        } else {
            console.error('Failed to create task:', result.error);
        }
    } catch (error) {
        console.error('Error during test:', error);
    }
}

testTaskCreation();
