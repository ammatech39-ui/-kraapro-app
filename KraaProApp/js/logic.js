/* js/logic.js */

/**
 * دالة لمعرفة عدد الأيام في شهر وسنة معينة (تتعامل مع السنوات الكبيسة تلقائياً)
 * @param {number} year - السنة (مثال: 2026)
 * @param {number} month - الشهر من 1 إلى 12
 */
export function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

/**
 * دالة لتحديد الفئة اللونية للخلية بناءً على عدد ساعات العمل
 * @param {number} hours - عدد الساعات
 * @returns {string} اسم كلاس التنسيق (c0, cp, cf, cx)
 */
export function getCellClass(hours) {
    if (hours === undefined || hours === null || hours === "" || parseFloat(hours) === 0) return "c0"; // متوقف / صفر
    const h = parseFloat(hours);
    if (h < 8) return "cp";  // عمل جزئي
    if (h === 8) return "cf"; // يوم عمل كامل
    return "cx";             // ساعات إضافية
}

/**
 * دالة حساب الإحصائيات الشاملة للشهر الحالي
 * @param {object} monthlyData - بيانات الشهر المجلوبة من قاعدة البيانات
 * @param {Array} machines - قائمة الآلات المسجلة في النظام
 * @param {number} totalDays - عدد أيام الشهر الحالي
 */
export function calculateMonthlyStats(monthlyData, machines, totalDays) {
    let totalHours = 0;
    let totalEarnings = 0;
    let totalPossibleHours = 0;

    // تحضير هيكل بيانات ملخص لكل آلة على حدة
    const machineSummaries = {};
    machines.forEach(mach => {
        machineSummaries[mach.id] = {
            id: mach.id,
            name: mach.name,
            price: parseFloat(mach.price) || 0,
            totalHours: 0,
            totalEarnings: 0,
            workingDaysCount: 0
        };
    });

    // استخراج السجلات اليومية (إذا كانت موجودة)
    const records = (monthlyData && monthlyData.records) ? monthlyData.records : {};

    // المرور على كل آلة وحساب ساعاتها وأرباحها اليومية
    machines.forEach(mach => {
        const machId = mach.id;
        const rate = parseFloat(mach.price) || 0;
        totalPossibleHours += totalDays * 8; // معيار التشغيل الكامل (8 ساعات يومياً)

        for (let day = 1; day <= totalDays; day++) {
            const dayHours = (records[machId] && records[machId][day]) ? parseFloat(records[machId][day]) : 0;
            
            if (dayHours > 0) {
                machineSummaries[machId].totalHours += dayHours;
                machineSummaries[machId].totalEarnings += dayHours * rate;
                machineSummaries[machId].workingDaysCount++;

                totalHours += dayHours;
                totalEarnings += dayHours * rate;
            }
        }
    });

    // حساب معدل العمل اليومي ونسبة التشغيل العامة لجميع الآلات
    const avgDailyHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0;
    const performanceRate = totalPossibleHours > 0 ? ((totalHours / totalPossibleHours) * 100).toFixed(1) : 0;

    return {
        totalHours,
        totalEarnings,
        avgDailyHours,
        performanceRate: `${performanceRate}%`,
        machineSummaries
    };
}

/**
 * دالة مساعدة لتنسيق المبالغ المالية بشكل مريح للعين (مثال: 150,000)
 * @param {number} num - المبلغ المراد تنسيقه
 */
export function formatCurrency(num) {
    if (num === undefined || num === null || isNaN(num)) return "0.00";
    return new Intl.NumberFormat('ar-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}