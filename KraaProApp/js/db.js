/* js/db.js */

const DB_NAME = "KraaProDB";
const DB_VERSION = 1;

/**
 * تهيئة قاعدة البيانات وإنشاء الجداول إذا لم تكن موجودة
 */
export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 1. جدول الآلات (يخزن أسماء الآلات وأسعارها)
            if (!db.objectStoreNames.contains("machines")) {
                db.createObjectStore("machines", { keyPath: "id", autoIncrement: true });
            }

            // 2. جدول بيانات الأشهر (يخزن الساعات والبيانات اليومية لكل شهر)
            if (!db.objectStoreNames.contains("monthlyData")) {
                db.createObjectStore("monthlyData", { keyPath: "monthId" });
            }

            // 3. جدول الإعدادات العامة (مثل المظهر الداكن أو الفاتح)
            if (!db.objectStoreNames.contains("settings")) {
                db.createObjectStore("settings", { keyPath: "key" });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * دالة عامة لحفظ أو تحديث بيانات في جدول معين
 * @param {string} storeName - اسم الجدول
 * @param {object} data - البيانات المراد حفظها
 */
export async function dbSave(storeName, data) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

/**
 * دالة عامة لجلب بيانات بواسطة المفتاح (Key)
 * @param {string} storeName - اسم الجدول
 * @param {any} key - المفتاح المراد البحث عنه
 */
export async function dbGet(storeName, key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * دالة لجلب كل السجلات الموجودة في جدول معين (مثل جلب كل الآلات)
 * @param {string} storeName - اسم الجدول
 */
export async function dbGetAll(storeName) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * دالة لحذف سجل معين من جدول
 * @param {string} storeName - اسم الجدول
 * @param {any} key - المفتاح المراد حذفه
 */
export async function dbDelete(storeName, key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}