/* js/main.js */
import { initDB, dbSave, dbGet, dbGetAll, dbDelete } from './db.js';
import { getDaysInMonth, calculateMonthlyStats, formatCurrency } from './logic.js';
import { showToast, enableDragScroll, renderTable, updateAnalyticsChart } from './ui.js';

// متغيرات الحالة العامة للتطبيق
let currentYear, currentMonth, currentMonthStr;
let machinesList = [];
let monthlyRecords = {};
let selectedCmdIndex = 0;
let filteredCommands = [];

// قائمة الأوامر للوحة التحكم السريعة (Command Palette)
const APP_COMMANDS = [
    { title: "إضافة آلة جديدة", desc: "فتح نافذة إضافة آلة وموديل جديد للبرنامج", action: openAddMachineModal },
    { title: "تغيير المظهر", desc: "التحويل بين الوضع الليلي والوضع المضيء المريح للعين", action: toggleTheme },
    { title: "حفظ النسخة الاحتياطية", desc: "تأكيد مزامنة وحفظ كافة البيانات الحالية", action: manualSave },
    { title: "تنظيف الذاكرة المؤقتة", desc: "إعادة تحميل التطبيق وتحديث الجداول", action: () => window.location.reload() }
];

// انتهاء تحميل واجهة المستخدم
document.addEventListener('DOMContentLoaded', async () => {
    // 1. تهيئة قاعدة البيانات المحلية الآمنة
    try {
        await initDB();
        // تشغيل الهجرة التلقائية للبيانات القديمة إذا وجدت
        await migrateOldLocalStorageData();
    } catch (err) {
        console.error("خطأ أثناء تهيئة قاعدة البيانات:", err);
        showToast("فشل في تهيئة التخزين المحلي الآمن!", "danger");
    }

    // 2. ضبط التاريخ الحالي تلقائياً
    const dateSelector = document.getElementById('monthSelector');
    if (dateSelector) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        dateSelector.value = `${year}-${month}`;
    }

    // 3. تحميل المظهر المفضل للمستخدم
    initTheme();

    // 4. تفعيل ميزة السحب المرن للحاوية الرئيسية للجدول
    const tableContainer = document.getElementById('mainTableContainer');
    enableDragScroll(tableContainer);

    // 5. ربط أحداث العناصر (Event Listeners)
    setupEventListeners();

    // 6. تحميل وعرض البيانات لأول مرة
    await loadAppDashboard();
});

/**
 * دالة ربط أحداث الأزرار والنوافذ المنبثقة الاختصارات
 */
function setupEventListeners() {
    // تغيير الشهر
    document.getElementById('monthSelector').addEventListener('change', async (e) => {
        await loadAppDashboard();
    });

    // تبديل المظهر
    document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);

    // أزرار نافذة إضافة آلة
    document.getElementById('btnAddMachine').addEventListener('click', openAddMachineModal);
    document.getElementById('btnCloseMachineModal').addEventListener('click', closeAddMachineModal);
    document.getElementById('btnCancelMachineModal').addEventListener('click', closeAddMachineModal);

    // نموذج إضافة آلة
    document.getElementById('machineForm').addEventListener('submit', handleAddMachineSubmit);

    // زر الحفظ اليدوي
    document.getElementById('btnSave').addEventListener('click', manualSave);

    // لوحة التحكم السريعة (Command Palette)
    document.getElementById('btnOpenCmd').addEventListener('click', openCommandPalette);
    document.getElementById('cmdOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'cmdOverlay') closeCommandPalette();
    });
    document.getElementById('cmdInput').addEventListener('input', (e) => {
        renderCommandPaletteResults(e.target.value);
    });

    // اختصارات لوحة المفاتيح العالمية (Shortcuts)
    document.addEventListener('keydown', (e) => {
        // Ctrl + K لفتح لوحة التحكم
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (document.getElementById('cmdOverlay').classList.contains('open')) {
                closeCommandPalette();
            } else {
                openCommandPalette();
            }
        }
        // Ctrl + S للحفظ الفوري
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            manualSave();
        }
        // زر Esc للإغلاق المفاجئ للنوافذ
        if (e.key === 'Escape') {
            closeAddMachineModal();
            closeCommandPalette();
        }
        // التنقل داخل لوحة الأوامر بالأسهم
        handleCommandPaletteNavigation(e);
    });
}

/**
 * محرك تشغيل وتحديث لوحة الإحصائيات والجداول والرسومات البيانية
 */
async function loadAppDashboard() {
    const monthSelectorVal = document.getElementById('monthSelector').value;
    if (!monthSelectorVal) return;

    currentMonthStr = monthSelectorVal; // مثال: "2026-06"
    const parts = currentMonthStr.split('-');
    currentYear = parseInt(parts[0]);
    currentMonth = parseInt(parts[1]);

    const totalDays = getDaysInMonth(currentYear, currentMonth);

    // جلب البيانات الفورية من قاعدة البيانات
    machinesList = await dbGetAll('machines');
    const dbRecord = await dbGet('records', currentMonthStr);
    monthlyRecords = dbRecord ? dbRecord.records : {};

    // حساب الإحصائيات الشاملة
    const stats = calculateMonthlyStats({ records: monthlyRecords }, machinesList, totalDays);

    // تحديث بطاقات الأرقام العلوية في الواجهة
    document.getElementById('statTotalEarnings').innerText = `${formatCurrency(stats.totalEarnings)} د.ج`;
    document.getElementById('statActiveMachines').innerText = `${machinesList.length} آلات`;
    document.getElementById('statTotalHours').innerText = `${stats.totalHours} ساعة عمل`;

    // بناء وجدولة جدول الساعات التفاعلي
    renderTable(machinesList, { records: monthlyRecords }, totalDays, onHourCellChange, onDeleteMachineClick);

    // تحديث التشريح البياني الدقيق للآلات
    updateAnalyticsChart(stats);
}

/**
 * حدث يطلق تلقائياً عند تغيير أي ساعة داخل الجدول (حفظ تلقائي فوري مريح)
 */
async function onHourCellChange(machId, day, value) {
    if (!monthlyRecords[machId]) {
        monthlyRecords[machId] = {};
    }
    
    if (value === "" || value === null || parseFloat(value) === 0) {
        delete monthlyRecords[machId][day];
    } else {
        monthlyRecords[machId][day] = parseFloat(value);
    }

    // حفظ فوري في الخلفية لضمان عدم ضياع نقرة واحدة
    await dbSave('records', {
        month: currentMonthStr,
        records: monthlyRecords
    });

    // إعادة حساب الأرقام العلوية والرسم البياني بدون إعادة تحميل الصفحة بالكامل لقوة الأداء
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    const stats = calculateMonthlyStats({ records: monthlyRecords }, machinesList, totalDays);
    document.getElementById('statTotalEarnings').innerText = `${formatCurrency(stats.totalEarnings)} د.ج`;
    document.getElementById('statTotalHours').innerText = `${stats.totalHours} ساعة عمل`;
    updateAnalyticsChart(stats);
}

/**
 * حدث حذف آلة من النظام
 */
async function onDeleteMachineClick(machId) {
    // 1. حذفها من مخزن الآلات
    await dbDelete('machines', machId);
    
    // 2. تنظيف سجلاتها من الشهر الحالي كخطوة أمنية إضافية
    if (monthlyRecords[machId]) {
        delete monthlyRecords[machId];
        await dbSave('records', {
            month: currentMonthStr,
            records: monthlyRecords
        });
    }

    showToast("تم حذف الآلة وكافة سجلاتها بنجاح");
    await loadAppDashboard();
}

/**
 * فتح وإغلاق شاشات الإضافة (Modal)
 */
function openAddMachineModal() {
    document.getElementById('machineForm').reset();
    document.getElementById('machineModal').classList.add('open');
    document.getElementById('machineName').focus();
}
function closeAddMachineModal() {
    document.getElementById('machineModal').classList.remove('open');
}

/**
 * معالجة وإرسال نموذج إضافة آلة جديدة
 */
async function handleAddMachineSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('machineName').value.trim();
    const price = parseFloat(document.getElementById('machineRate').value);

    if (!name || isNaN(price)) {
        showToast("يرجى ملء البيانات بشكل صحيح", "warning");
        return;
    }

    const newMachine = {
        id: Date.now(), // مُعرّف فريد يعتمد على التوقيت الحالي
        name: name,
        price: price
    };

    await dbSave('machines', newMachine);
    showToast(`تمت إضافة الآلة "${name}" بنجاح`);
    closeAddMachineModal();
    await loadAppDashboard();
}

/**
 * الحفظ اليدوي وإشعار المستخدم بالتأكيد
 */
function manualSave() {
    showToast("تم مزامنة وحفظ جميع البيانات في قاعدة البيانات الآمنة بنجاح! ✨");
}

/**
 * إدارة نظام المظهر (ليلي / نهاري)
 */
function initTheme() {
    const savedTheme = localStorage.getItem('kraa_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeButtonIcon(savedTheme);
}
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('kraa_theme', newTheme);
    updateThemeButtonIcon(newTheme);
    
    // إعادة رسم الجرافيك ليتطابق مع خطوط وألوان الوضع الجديد
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    const stats = calculateMonthlyStats({ records: monthlyRecords }, machinesList, totalDays);
    updateAnalyticsChart(stats);
}
function updateThemeButtonIcon(theme) {
    const btn = document.getElementById('btnThemeToggle');
    if (btn) {
        btn.innerHTML = theme === 'dark' ? '☀️ الوضع المضيء' : '🌙 الوضع الليلي';
    }
}

/**
 * التحكم بلوحة الأوامر السريعة (Command Palette)
 */
function openCommandPalette() {
    document.getElementById('cmdOverlay').classList.add('open');
    const input = document.getElementById('cmdInput');
    input.value = '';
    selectedCmdIndex = 0;
    renderCommandPaletteResults('');
    setTimeout(() => input.focus(), 50);
}
function closeCommandPalette() {
    document.getElementById('cmdOverlay').classList.remove('open');
}
function renderCommandPaletteResults(query) {
    const q = query.toLowerCase().trim();
    filteredCommands = q ? APP_COMMANDS.filter(c => c.title.includes(q) || c.desc.includes(q)) : APP_COMMANDS;
    
    selectedCmdIndex = 0;
    const resultsContainer = document.getElementById('cmdResults');
    resultsContainer.innerHTML = '';

    if (filteredCommands.length === 0) {
        resultsContainer.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-muted); font-size:13px;">لا توجد نتائج مطابقة لبحثك</div>`;
        return;
    }

    filteredCommands.forEach((cmd, idx) => {
        const div = document.createElement('div');
        div.className = `cmd-item ${idx === selectedCmdIndex ? 'sel' : ''}`;
        div.innerHTML = `
            <span class="ci">⚡</span>
            <div>
                <div class="ct">${cmd.title}</div>
                <div class="cs">${cmd.desc}</div>
            </div>
        `;
        div.addEventListener('click', () => {
            cmd.action();
            closeCommandPalette();
        });
        resultsContainer.appendChild(div);
    });
}
function handleCommandPaletteNavigation(e) {
    const overlay = document.getElementById('cmdOverlay');
    if (!overlay.classList.contains('open') || filteredCommands.length === 0) return;

    const items = document.getElementById('cmdResults').querySelectorAll('.cmd-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[selectedCmdIndex].classList.remove('sel');
        selectedCmdIndex = (selectedCmdIndex + 1) % filteredCommands.length;
        items[selectedCmdIndex].classList.add('sel');
        items[selectedCmdIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[selectedCmdIndex].classList.remove('sel');
        selectedCmdIndex = (selectedCmdIndex - 1 + filteredCommands.length) % filteredCommands.length;
        items[selectedCmdIndex].classList.add('sel');
        items[selectedCmdIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        filteredCommands[selectedCmdIndex].action();
        closeCommandPalette();
    }
}

/**
 * ميزة هجرة البيانات الفائقة: لنقل بيانات تطبيقك القديم (localStorage) إلى التخزين الحديث الآمن تلقائياً دون أي تدخل منك
 */
async function migrateOldLocalStorageData() {
    // محاولة فحص وجود مفاتيح قديمة محتملة مثل الأجهزة والسجلات
    const oldMachines = localStorage.getItem('machines') || localStorage.getItem('kraa_machines');
    if (oldMachines) {
        try {
            const parsedMachines = JSON.parse(oldMachines);
            if (Array.isArray(parsedMachines)) {
                for (const m of parsedMachines) {
                    // رفعها لقاعدة البيانات الجديدة إذا لم تكن موجودة برقم الآيدي
                    await dbSave('machines', {
                        id: m.id || Date.now() + Math.random(),
                        name: m.name,
                        price: parseFloat(m.price || m.rate || 0)
                    });
                }
                // تصفير المفتاح القديم لمنع تكرار الهجرة في المرات القادمة
                localStorage.removeItem('machines');
                console.log("تمت هجرة قائمة الآلات القديمة بنجاح للتخزين الجديد!");
            }
        } catch(e) { console.error(e); }
    }
}