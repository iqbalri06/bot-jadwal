// Role-based permission check
const checkPermission = (userRole, requiredRole) => {
    const roles = {
        'user': 1,
        'admin': 2,
        'superadmin': 3
    };
    
    return roles[userRole] >= roles[requiredRole];
};

// Command validation utilities
const commandValidator = {
    // Check if a user has permission to perform an action
    hasPermission: (userRole, action) => {
        const permissionMap = {
            // User permissions
            'viewTasks': ['user', 'admin', 'superadmin'],
            'markTaskDone': ['user', 'admin', 'superadmin'],
            
            // Admin permissions
            'createTask': ['admin', 'superadmin'],
            'updateTask': ['admin', 'superadmin'],
            'deleteTask': ['admin', 'superadmin'],
            'viewTaskStatus': ['admin', 'superadmin'],
            
            // Super admin permissions
            'viewUsers': ['superadmin'],
            'createUser': ['superadmin'],
            'updateUserRole': ['superadmin'],
            'deleteUser': ['superadmin']
        };
        
        const requiredRole = permissionMap[action]?.[0];
        if (!requiredRole) return false;
        
        return checkPermission(userRole, requiredRole);
    },
    
    // Parse command from message
    parseCommand: (text) => {
        if (!text || typeof text !== 'string' || !text.startsWith('/')) {
            return { command: null, args: [] };
        }
        
        const parts = text.trim().split(' ');
        const command = parts[0].substring(1).toLowerCase();
        const args = parts.slice(1);
        
        return { command, args };
    },
    
    // Validate command format based on expected arguments
    validateCommand: (command, args, expectedArgs) => {
        if (!expectedArgs) return { isValid: true };
        
        const errors = [];
        
        expectedArgs.forEach((arg, index) => {
            if (arg.required && (args.length <= index || !args[index])) {
                errors.push(`Parameter ${arg.name} wajib diisi.`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    },
    
    // Get expected arguments for a command
    getExpectedArgs: (command) => {
        const commandArgsMap = {
            'register': [
                { name: 'nomor', required: true },
                { name: 'nama', required: true },
                { name: 'role', required: true, values: ['admin', 'user'] }
            ],
            'role': [
                { name: 'nomor', required: true },
                { name: 'role', required: true, values: ['admin', 'user'] }
            ],
            'add': [
                { name: 'judul', required: true },
                { name: 'deadline', required: true }
            ],
            'edit': [
                { name: 'nomor', required: true }
            ],
            'task': [
                { name: 'nomor', required: true }
            ],
            'status': [
                { name: 'nomor', required: true }
            ],
            'done': [
                { name: 'nomor', required: true }
            ],
            'delete': [
                { name: 'nomor', required: true }
            ],
            'remove': [
                { name: 'nomor', required: true }
            ]
        };
        
        return commandArgsMap[command] || null;
    },
    
    // Validate a phone number format
    validatePhoneNumber: (number) => {
        // Simple validation - adjust as needed
        return /^[0-9]{10,15}$/.test(number);
    }
};

module.exports = commandValidator;
