/**
 * Agent Task System
 *
 * A dynamic task management system similar to Claude Code's todo list.
 * Manages planning, execution tracking, and progress reporting for agentic workflows.
 */

// Task status enum
export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

// Task priority enum
export const TaskPriority = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Creates a new task object
 */
export function createTask({
  id = null,
  content,
  activeForm,
  status = TaskStatus.PENDING,
  priority = TaskPriority.MEDIUM,
  parentId = null,
  metadata = {},
  result = null,
  error = null,
  startTime = null,
  endTime = null,
  retryCount = 0,
  maxRetries = 2,
}) {
  return {
    id: id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,           // What needs to be done (imperative form)
    activeForm,        // Present continuous form shown during execution
    status,
    priority,
    parentId,          // For sub-tasks
    metadata,          // Extra data (toolName, params, etc.)
    result,            // Result when completed
    error,             // Error message if failed
    startTime,
    endTime,
    retryCount,
    maxRetries,
    createdAt: Date.now(),
  };
}

/**
 * Agent Task Manager
 * Manages the lifecycle of tasks during agentic execution
 */
export class AgentTaskManager {
  constructor(onUpdate = null) {
    this.tasks = [];
    this.currentTaskId = null;
    this.executionId = `exec_${Date.now()}`;
    this.listeners = [];
    this.maxIterations = 50; // Safeguard against infinite loops
    this.currentIteration = 0;
    this.startTime = null;
    this.maxExecutionTime = 5 * 60 * 1000; // 5 minutes max

    if (onUpdate) {
      this.listeners.push(onUpdate);
    }
  }

  /**
   * Subscribe to task updates
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  _notify() {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (e) {
        console.error('Task listener error:', e);
      }
    });
  }

  /**
   * Get current state snapshot
   */
  getState() {
    return {
      executionId: this.executionId,
      tasks: [...this.tasks],
      currentTaskId: this.currentTaskId,
      currentIteration: this.currentIteration,
      maxIterations: this.maxIterations,
      progress: this.getProgress(),
      summary: this.getSummary(),
      isComplete: this.isComplete(),
      hasError: this.hasError(),
    };
  }

  /**
   * Add a new task
   */
  addTask(taskConfig) {
    const task = createTask(taskConfig);
    this.tasks.push(task);
    this._notify();
    return task;
  }

  /**
   * Add multiple tasks at once
   */
  addTasks(taskConfigs) {
    const newTasks = taskConfigs.map(config => createTask(config));
    this.tasks.push(...newTasks);
    this._notify();
    return newTasks;
  }

  /**
   * Update task plan - replace pending tasks while keeping completed ones
   */
  updatePlan(newTaskConfigs) {
    // Keep completed and in-progress tasks
    const preservedTasks = this.tasks.filter(t =>
      t.status === TaskStatus.COMPLETED ||
      t.status === TaskStatus.IN_PROGRESS
    );

    // Create new tasks for the updated plan
    const newTasks = newTaskConfigs.map(config => createTask(config));

    this.tasks = [...preservedTasks, ...newTasks];
    this._notify();
    return newTasks;
  }

  /**
   * Insert a task at a specific position
   */
  insertTaskAt(index, taskConfig) {
    const task = createTask(taskConfig);
    this.tasks.splice(index, 0, task);
    this._notify();
    return task;
  }

  /**
   * Insert a task after the current task (for dynamic task addition)
   */
  insertAfterCurrent(taskConfig) {
    const currentIndex = this.tasks.findIndex(t => t.id === this.currentTaskId);
    if (currentIndex >= 0) {
      return this.insertTaskAt(currentIndex + 1, taskConfig);
    }
    return this.addTask(taskConfig);
  }

  /**
   * Start a task
   */
  startTask(taskId) {
    if (!this.startTime) {
      this.startTime = Date.now();
    }

    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = TaskStatus.IN_PROGRESS;
      task.startTime = Date.now();
      this.currentTaskId = taskId;
      this._notify();
    }
    return task;
  }

  /**
   * Complete a task with result
   */
  completeTask(taskId, result = null) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = TaskStatus.COMPLETED;
      task.result = result;
      task.endTime = Date.now();
      if (this.currentTaskId === taskId) {
        this.currentTaskId = null;
      }
      this._notify();
    }
    return task;
  }

  /**
   * Mark a task as failed
   */
  failTask(taskId, error) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.error = error;
      task.endTime = Date.now();

      // Check if we should retry
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = TaskStatus.PENDING;
        task.error = `Retry ${task.retryCount}/${task.maxRetries}: ${error}`;
      } else {
        task.status = TaskStatus.FAILED;
      }

      if (this.currentTaskId === taskId) {
        this.currentTaskId = null;
      }
      this._notify();
    }
    return task;
  }

  /**
   * Skip a task
   */
  skipTask(taskId, reason = 'Skipped') {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = TaskStatus.SKIPPED;
      task.result = reason;
      task.endTime = Date.now();
      if (this.currentTaskId === taskId) {
        this.currentTaskId = null;
      }
      this._notify();
    }
    return task;
  }

  /**
   * Get next pending task
   */
  getNextTask() {
    return this.tasks.find(t => t.status === TaskStatus.PENDING);
  }

  /**
   * Get current task
   */
  getCurrentTask() {
    return this.tasks.find(t => t.id === this.currentTaskId);
  }

  /**
   * Check if all tasks are complete
   */
  isComplete() {
    if (this.tasks.length === 0) return false;
    return this.tasks.every(t =>
      t.status === TaskStatus.COMPLETED ||
      t.status === TaskStatus.FAILED ||
      t.status === TaskStatus.SKIPPED
    );
  }

  /**
   * Check if any task has failed (and exhausted retries)
   */
  hasError() {
    return this.tasks.some(t => t.status === TaskStatus.FAILED);
  }

  /**
   * Get progress statistics
   */
  getProgress() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const failed = this.tasks.filter(t => t.status === TaskStatus.FAILED).length;
    const skipped = this.tasks.filter(t => t.status === TaskStatus.SKIPPED).length;
    const inProgress = this.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const pending = this.tasks.filter(t => t.status === TaskStatus.PENDING).length;

    return {
      total,
      completed,
      failed,
      skipped,
      inProgress,
      pending,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      done: completed + failed + skipped,
    };
  }

  /**
   * Get human-readable summary
   */
  getSummary() {
    const { total, completed, failed, skipped, inProgress } = this.getProgress();
    const parts = [];

    if (completed > 0) parts.push(`${completed} completed`);
    if (inProgress > 0) parts.push(`${inProgress} in progress`);
    if (failed > 0) parts.push(`${failed} failed`);
    if (skipped > 0) parts.push(`${skipped} skipped`);

    return `${parts.join(', ')} (${total} total)`;
  }

  /**
   * Increment iteration counter and check safeguards
   */
  incrementIteration() {
    this.currentIteration++;

    // Check iteration limit
    if (this.currentIteration >= this.maxIterations) {
      return {
        shouldStop: true,
        reason: `Maximum iterations reached (${this.maxIterations}). Stopping to prevent infinite loop.`,
      };
    }

    // Check execution time
    if (this.startTime && (Date.now() - this.startTime) > this.maxExecutionTime) {
      return {
        shouldStop: true,
        reason: `Maximum execution time reached (${this.maxExecutionTime / 1000}s). Stopping.`,
      };
    }

    return { shouldStop: false };
  }

  /**
   * Reset for a new execution
   */
  reset() {
    this.tasks = [];
    this.currentTaskId = null;
    this.executionId = `exec_${Date.now()}`;
    this.currentIteration = 0;
    this.startTime = null;
    this._notify();
  }

  /**
   * Serialize state for context management
   */
  toJSON() {
    return {
      executionId: this.executionId,
      tasks: this.tasks,
      currentIteration: this.currentIteration,
      progress: this.getProgress(),
    };
  }

  /**
   * Create a compact summary for AI context (saves tokens)
   */
  toCompactContext() {
    const statusEmoji = {
      [TaskStatus.PENDING]: '⏳',
      [TaskStatus.IN_PROGRESS]: '🔄',
      [TaskStatus.COMPLETED]: '✅',
      [TaskStatus.FAILED]: '❌',
      [TaskStatus.SKIPPED]: '⏭️',
    };

    const lines = this.tasks.map((t, i) => {
      const emoji = statusEmoji[t.status];
      const resultInfo = t.result ? ` → ${typeof t.result === 'string' ? t.result.slice(0, 100) : 'done'}` : '';
      const errorInfo = t.error ? ` [Error: ${t.error}]` : '';
      return `${i + 1}. ${emoji} ${t.content}${resultInfo}${errorInfo}`;
    });

    const progress = this.getProgress();
    return `TASK PROGRESS (${progress.percentage}% complete, iteration ${this.currentIteration}/${this.maxIterations}):\n${lines.join('\n')}`;
  }
}

/**
 * Create a task manager instance with React state integration
 */
export function createAgentTaskManager(setState) {
  return new AgentTaskManager((state) => {
    setState({ ...state });
  });
}
