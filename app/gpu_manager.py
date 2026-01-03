import os
import gc
import time
import threading
from typing import Optional, Callable, Any

class GPUManager:
    """GPU resource manager with auto-offload."""
    
    def __init__(self, idle_timeout: int = 300):
        self.idle_timeout = idle_timeout
        self._model = None
        self._last_used = 0
        self._lock = threading.Lock()
        self._timer: Optional[threading.Timer] = None
        self._load_func: Optional[Callable] = None
        
    def get_model(self, load_func: Callable) -> Any:
        """Get or load model."""
        with self._lock:
            self._load_func = load_func
            if self._model is None:
                self._model = load_func()
            self._last_used = time.time()
            self._schedule_offload()
            return self._model
    
    def _schedule_offload(self):
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(self.idle_timeout, self._check_offload)
        self._timer.daemon = True
        self._timer.start()
    
    def _check_offload(self):
        with self._lock:
            if self._model and time.time() - self._last_used >= self.idle_timeout:
                self._offload()
    
    def _offload(self):
        if self._model:
            del self._model
            self._model = None
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
    
    def force_offload(self):
        """Force offload model from GPU."""
        with self._lock:
            self._offload()
            return True
    
    def get_status(self) -> dict:
        """Get GPU status."""
        with self._lock:
            status = {
                "model_loaded": self._model is not None,
                "idle_timeout": self.idle_timeout,
                "last_used": self._last_used,
                "idle_seconds": int(time.time() - self._last_used) if self._last_used else 0
            }
        
        try:
            import subprocess
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=index,memory.used,memory.total,utilization.gpu",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                gpu_id = os.environ.get("NVIDIA_VISIBLE_DEVICES", "0")
                for line in result.stdout.strip().split("\n"):
                    parts = [p.strip() for p in line.split(",")]
                    if parts[0] == gpu_id:
                        status["gpu"] = {
                            "id": int(parts[0]),
                            "memory_used_mb": int(parts[1]),
                            "memory_total_mb": int(parts[2]),
                            "utilization": int(parts[3])
                        }
                        break
        except Exception:
            pass
        
        return status

gpu_manager = GPUManager(idle_timeout=int(os.environ.get("GPU_IDLE_TIMEOUT", 300)))
