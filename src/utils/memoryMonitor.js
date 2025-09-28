/**
 * Memory monitoring utility to track and report Node.js memory usage
 * This helps identify memory leaks and prevent "out of memory" crashes
 */

const memoryMonitor = {
    // Start monitoring memory usage at intervals
    startMonitoring: (intervalMinutes = 5) => {
        // Convert minutes to milliseconds
        const interval = intervalMinutes * 60 * 1000;
        
        // Initial memory usage report
        memoryMonitor.logMemoryUsage();
        
        // Schedule regular checks
        const timer = setInterval(() => {
            memoryMonitor.logMemoryUsage();
        }, interval);
        
        return timer;
    },
    
    // Log current memory usage
    logMemoryUsage: () => {
        const memoryUsage = process.memoryUsage();
        
        // Convert bytes to MB for readability
        const used = {
            rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + " MB",
            heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
            heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
            external: (memoryUsage.external / 1024 / 1024).toFixed(2) + " MB",
        };
        
        // Log memory usage with timestamp
        console.log('\n=== Memory Usage Report ===');
        console.log('Time:', new Date().toISOString());
        console.log('RSS (Resident Set Size):', used.rss);
        console.log('Heap Total:', used.heapTotal);
        console.log('Heap Used:', used.heapUsed);
        console.log('External:', used.external);
        console.log('==========================\n');
        
        // Check for high memory usage
        const heapUsedMB = parseFloat(used.heapUsed);
        if (heapUsedMB > 200) { // Warning threshold: 200MB
            console.warn('⚠️ WARNING: High memory usage detected! Consider restarting the application.');
        }
    },
    
    // Force garbage collection (only works with --expose-gc flag)
    attemptGarbageCollection: () => {
        try {
            if (global.gc) {
                global.gc();
                console.log('Manual garbage collection triggered');
                return true;
            } else {
                console.log('Garbage collection not available (run Node with --expose-gc flag)');
                return false;
            }
        } catch (e) {
            console.error('Error triggering garbage collection:', e);
            return false;
        }
    },
    
    // Monitor and attempt cleanup if memory usage is too high
    createMemoryGuard: (thresholdMB = 500, intervalMinutes = 10) => {
        const interval = intervalMinutes * 60 * 1000;
        
        return setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
            
            if (heapUsedMB > thresholdMB) {
                console.warn(`⚠️ MEMORY ALERT: Heap usage (${heapUsedMB.toFixed(2)}MB) exceeds threshold (${thresholdMB}MB)`);
                memoryMonitor.attemptGarbageCollection();
                
                // Log memory usage after GC attempt
                setTimeout(() => memoryMonitor.logMemoryUsage(), 1000);
            }
        }, interval);
    }
};

module.exports = memoryMonitor;
