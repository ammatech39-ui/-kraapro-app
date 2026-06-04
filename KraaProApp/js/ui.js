/* js/ui.js */
import { getCellClass, formatCurrency } from './logic.js';

let myChart = null; // للاحتفاظ بنسخة الرسم البياني ومنع تكراره

/**
 * دالة لإظهار تنبيه سريع (Toast) أسفل الشاشة
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast`;
    if (type === 'danger') toast.style.borderRightColor = 'var(--danger)';
    if (type === 'warning') toast.style.borderRightColor = 'var(--warning)';
    
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * ميزة السحب الأفقي المرن للجداول بالفأرة من تطبيقك الأصلي
 */
export function enableDragScroll(el) {
    if (!el) return;
    let isDown = false;
    let startX;
    let scrollLeft;

    el.addEventListener('mousedown', (e) => {
        if (e.target.closest('input, button, select, textarea')) return;
        isDown = true;
        el.classList.add('dragging');
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
        isDown = false;
        el.classList.remove('dragging');
    });

    el.addEventListener('mouseleave', () => {
        isDown = false;
        el.classList.remove('dragging');
    });

    el.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.5; // سرعة السحب
        el.scrollLeft = scrollLeft - walk;
    });
}

/**
 * بناء ورسم الجدول الرئيسي بالكامل ديناميكياً
 */
export function renderTable(machines, monthlyData, totalDays, onInputChange, onDeleteMachine) {
    const thead = document.getElementById('mainTableHead');
    const tbody = document.getElementById('mainTableBody');
    
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (machines.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${totalDays + 5}" style="text-align:center; padding:30px; color:var(--text-muted);">لا توجد آلات مضافة حالياً. اضغط على "إضافة آلة" للبدء.</td></tr>`;
        return;
    }

    // 1. بناء رأس الجدول (Header)
    let headerRow = `<tr>
        <th>الآلة / الموديل</th>
        <th>السعر (ساعة)</th>`;
    
    for (let d = 1; d <= totalDays; d++) {
        headerRow += `<th style="text-align:center; min-width:45px;">${d}</th>`;
    }
    
    headerRow += `<th>المجموع</th>
        <th>المداخيل</th>
        <th style="text-align:center;">إجراءات</th>
    </tr>`;
    thead.innerHTML = headerRow;

    // 2. بناء أسطر الآلات (Rows)
    const records = (monthlyData && monthlyData.records) ? monthlyData.records : {};

    machines.forEach(mach => {
        const machId = mach.id;
        const rate = parseFloat(mach.price) || 0;
        let rowHoursSum = 0;

        let rowHtml = `<tr>
            <td style="font-weight:700;">${mach.name}</td>
            <td style="color:var(--text-muted); font-weight:600;">${rate} د.ج</td>`;

        // خلايا الأيام
        for (let d = 1; d <= totalDays; d++) {
            const val = (records[machId] && records[machId][d]) !== undefined ? records[machId][d] : '';
            if (val !== '') rowHoursSum += parseFloat(val) || 0;
            
            const cellClass = getCellClass(val);

            rowHtml += `<td style="padding:4px; text-align:center;">
                <input type="number" 
                       class="${cellClass}" 
                       data-mach-id="${machId}" 
                       data-day="${d}" 
                       value="${val}" 
                       min="0" max="24" step="0.5"
                       style="width:45px; text-align:center; padding:6px 2px; border-radius:4px; font-weight:700; border:1px solid transparent;"
                >
            </td>`;
        }

        const rowEarnings = rowHoursSum * rate;

        rowHtml += `<td style="font-weight:700; text-align:center; color:var(--primary);">${rowHoursSum} سا</td>
            <td style="font-weight:800; color:var(--success); white-space:nowrap;">${formatCurrency(rowEarnings)} د.ج</td>
            <td style="text-align:center; padding:4px;">
                <button class="btn btn-danger btn-sm btn-delete-mach" data-id="${machId}" style="padding:4px 8px; font-size:11px;">🗑️ حذف</button>
            </td>
        </tr>`;

        tbody.insertAdjacentHTML('beforeend', rowHtml);
    });

    // ربط أحداث التغيير داخل خلايا الجدول لتحديث الألوان تلقائياً وحفظ التغييرات
    tbody.querySelectorAll('input[data-mach-id]').forEach(input => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            // تحديث لون الخلية فوراً لتجربة مستخدم سريعة
            e.target.className = getCellClass(val);
            onInputChange(
                parseInt(e.target.dataset.machId),
                parseInt(e.target.dataset.day),
                val
            );
        });
    });

    // ربط أزرار الحذف
    tbody.querySelectorAll('.btn-delete-mach').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (confirm("هل أنت متأكد من حذف هذه الآلة نهائياً؟ سيتم مسح سجلاتها أيضاً.")) {
                onDeleteMachine(parseInt(btn.dataset.id));
            }
        });
    });
}

/**
 * تحديث واجهة الرسم البياني (Chart.js) لتتوافق مع الوضع الداكن والفاتح ومجاميع الأرباح
 */
export function updateAnalyticsChart(stats) {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    const labels = [];
    const dataEarnings = [];

    Object.values(stats.machineSummaries).forEach(sum => {
        labels.push(sum.name);
        dataEarnings.push(sum.totalEarnings);
    });

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#2c3e50';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    if (myChart) {
        myChart.destroy(); // تدمير المخطط القديم لمنع تداخله عند التحديث
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'مداخيل الآلة (د.ج)',
                data: dataEarnings,
                backgroundColor: 'rgba(52, 152, 219, 0.65)',
                borderColor: '#3498db',
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { font: { family: 'Cairo' }, color: textColor } }
            },
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { font: { family: 'Cairo' }, color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Cairo' }, color: textColor }
                }
            }
        }
    });
}