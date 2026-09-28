        function formatRelativeTime(ms) {
            const seconds = Math.floor((Date.now() - ms) / 1000);
            if (seconds < 60) return 'hace un momento';
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `hace ${minutes} min`;
            const hours = Math.floor(minutes / 60);
            return `hace ${hours} h`;
        }

        function formatTimestamp(milliseconds) {
            const totalSeconds = Math.floor(milliseconds / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            if (hours > 0) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        function formatProcessingTime(milliseconds) {
            const totalSeconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            if (minutes > 0) {
                return `${minutes}m ${seconds}s`;
            }
            return `${seconds}s`;
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
            const size = (bytes / Math.pow(1024, unitIndex)).toFixed(1);
            return size + ' ' + units[unitIndex];
        }
