const PENDING = 'PENDING';
const FULFILLED = 'FULFILLED';
const REJECTED = 'REJECTED';

function Promise(executor) {
  this.status = PENDING;
  this.onFulfilledCbs = [];
  this.onRejectedCbs = [];

  const resolve = (value) => {
    if (this.status === PENDING) {
      this.status = FULFILLED;
      this.value = value;
      this.onFulfilledCbs.forEach((fn) => fn());
    }
  };

  const reject = (reason) => {
    if (this.status === PENDING) {
      this.status = REJECTED;
      this.reason = reason;
      this.onRejectedCbs.forEach((fn) => fn());
    }
  };

  try {
    executor(resolve, reject);
  } catch (e) {
    reject(e);
  }
}

Promise.prototype.then = function (onFulfilled, onRejected) {
  // onFulfilled，onRejected要有兼容处理
  onFulfilled =
    typeof onFulfilled === 'function' ? onFulfilled : (value) => value;
  onRejected =
    typeof onRejected === 'function'
      ? onRejected
      : (reason) => {
          throw reason;
        };

  // then要求返回一个Promise
  return promise2 = new Promise((resolve, reject) => {
    if (this.status === FULFILLED) {
      // A+ 规范要求
      // onFulfilled 和 onRejected 只有在执行环境堆栈仅包含平台代码时才可被调用。
      // 这一条的意思是实践中要确保 onFulfilled 和 onRejected 方法异步执行，
      // 且应该在 then 方法被调用的那一轮事件循环之后的新执行栈中执行。

      // 此处用setTimeout模拟异步，实际实现中回调函数应该是个微任务
      setTimeout(() => {
        asyncInner(onFulfilled, this.value, promise2, resolve, reject);
      });
    } else if (this.status === REJECTED) {
      setTimeout(() => {
        asyncInner(onRejected, this.reason, promise2, resolve, reject);
      });
    } else if (this.status === PENDING) {
      // pending状态时注册cb
      this.onFulfilledCbs.push(() => {
        setTimeout(() => {
          asyncInner(onFulfilled, this.value, promise2, resolve, reject);
        });
      });
      this.onRejectedCbs.push(() => {
        setTimeout(() => {
          asyncInner(onRejected, this.reason, promise2, resolve, reject);
        });
      });
    }
  });
};

// onFulfilled、onRejected的异步执行内部逻辑
function asyncInner(fn, value, promise, resolve, reject) {
  try {
    let x = fn(value);
    resolvePromise(promise, x, resolve, reject);
  } catch (e) {
    reject(e);
  }
}

/**
 * @description: 按A+要求：根据onFulfilled或onRejected的执行结果 确定then返回的promise是什么状态
 * @param {Promise} promise2 then要返回的Promise对象
 * @param {any} x onFulfilled或onRejected的执行结果
 * @param {Function} resolve promise2的resolve executor
 * @param {Function} reject promise2的reject executor
 * @return {*}
 */
function resolvePromise(promise2, x, resolve, reject) {
  if (promise2 === x) {
    // promise2 和 x为同一指向时，reject一个TypeError
    reject(new TypeError('Chaining cycle'));
  }

  if (x && (typeof x === 'object' || typeof x === 'function')) {
    let used = false;
    try {
      let then = x.then;
      if (typeof then === 'function') {
        // x是thenable
        then.call(
          x,
          (y) => {
            if (used) return;
            used = true;
            resolvePromise(promise2, y, resolve, reject);
          },
          (r) => {
            if (used) return;
            used = true;
            reject(r);
          }
        );
      } else {
        // x不是thenable
        if (used) return;
        used = true;
        resolve(x);
      }
    } catch (e) {
      if (used) return;
      used = true;
      reject(e);
    }
  } else {
    // onFulfilled或onRejected未返回值
    resolve(x);
  }
}



// aplus-test工具要求
Promise.defer = Promise.deferred = function () {
  const dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
};

module.exports = Promise;
