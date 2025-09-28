<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Bot WhatsApp untuk Manajemen Tugas Kuliah

This is a WhatsApp bot project using:
- @whiskeysockets/baileys for WhatsApp Web API
- sqlite3 for database
- Node.js runtime

The bot features a role-based task management system with these roles:
- Super Admin: can manage users, tasks, and view task completion status
- Admin: can manage tasks and view task completion status
- User: can view tasks and mark tasks as completed

Database schema:
- users: id, phone_number, name, role, created_at
- tasks: id, title, deadline, photo_path, created_by, created_at
- task_status: id, task_id, user_id, completed, completed_at

When making changes, be sure to:
1. Maintain proper role-based permissions
2. Handle file uploads/media correctly
3. Use proper error handling
4. Follow the existing code structure and naming conventions
