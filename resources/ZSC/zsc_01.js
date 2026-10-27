/**
 * 电子科技大学中山学院 强智教务系统适配
 * @since 2026-10-27
 * @description 支持学期理论课表导入，需先在网页完成登录并将周次切换为“全部”
 * @author Lanjunyee
 * @version 1.0
 */

function pageChanged() {
    throw new Error('学校课表页面结构不受支持，请打开「我的学期课表」，选择学期并将周次切换为「全部」后重试。');
}

function normalizedText(value) {
    return value.replace(/ /g, ' ').trim();
}

function parseWeeks(value) {
    var match = normalizedText(value).match(/^([0-9,，、\s-]+)[(（]周[)）]$/);
    if (!match) pageChanged();
    var weeks = [];
    var seen = {};
    var parts = match[1].split(/[,，、]/);
    for (var i = 0; i < parts.length; i += 1) {
        var range = parts[i].trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!range) pageChanged();
        var start = Number(range[1]);
        var end = range[2] ? Number(range[2]) : start;
        if (start < 1 || end > 60 || end < start) pageChanged();
        for (var week = start; week <= end; week += 1) {
            if (!seen[week]) {
                seen[week] = true;
                weeks.push(week);
            }
        }
    }
    if (weeks.length === 0) pageChanged();
    weeks.sort(function (left, right) { return left - right; });
    return weeks;
}

function parseCell(cell, day, startSection, endSection) {
    var blocks = Array.prototype.slice.call(cell.children).filter(function (element) {
        return element.classList.contains('kbcontent');
    });
    if (blocks.length !== 1) pageChanged();

    var hiddenBlocks = Array.prototype.slice.call(cell.querySelectorAll('.kbcontent1'));
    if (!normalizedText(blocks[0].textContent) && hiddenBlocks.some(function (block) {
        return normalizedText(block.textContent);
    })) {
        pageChanged();
    }

    for (var index = 0; index < cell.childNodes.length; index += 1) {
        var child = cell.childNodes[index];
        if (child.nodeType === 3) {
            if (normalizedText(child.textContent)) pageChanged();
        } else if (child.nodeType === 1) {
            if (child.tagName === 'INPUT' && child.type === 'hidden') continue;
            if (child.tagName === 'DIV' && (child.classList.contains('kbcontent') || child.classList.contains('kbcontent1'))) continue;
            pageChanged();
        } else if (child.nodeType !== 8) {
            pageChanged();
        }
    }

    var tokens = [];
    var text = '';
    function flushText() {
        var value = normalizedText(text);
        if (value) tokens.push({ title: null, value: value });
        text = '';
    }

    var nodes = blocks[0].childNodes;
    for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
        var node = nodes[nodeIndex];
        if (node.nodeType === 3) {
            text += node.textContent;
        } else if (node.nodeType === 1 && node.tagName === 'BR') {
            flushText();
        } else if (node.nodeType === 1 && node.tagName === 'FONT') {
            flushText();
            var title = node.getAttribute('title');
            if (['老师', '周次(节次)', '教室'].indexOf(title) === -1 || node.children.length !== 0) pageChanged();
            tokens.push({ title: title, value: normalizedText(node.textContent) });
        } else if (node.nodeType !== 8) {
            pageChanged();
        }
    }
    flushText();
    if (tokens.length === 0) return [];

    var courses = [];
    var group = [];

    function finishCourse() {
        if (group.length === 0 || group[0].title !== null || /^-{4,}$/.test(group[0].value)) pageChanged();
        var fields = {};
        for (var fieldIndex = 1; fieldIndex < group.length; fieldIndex += 1) {
            var token = group[fieldIndex];
            if (token.title === null || Object.prototype.hasOwnProperty.call(fields, token.title)) pageChanged();
            fields[token.title] = token.value;
        }
        if (!Object.prototype.hasOwnProperty.call(fields, '周次(节次)')) {
            pageChanged();
        }
        courses.push({
            name: group[0].value,
            teacher: fields['老师'] || '',
            position: fields['教室'] || '',
            day: day,
            startSection: startSection,
            endSection: endSection,
            weeks: parseWeeks(fields['周次(节次)'])
        });
        group = [];
    }

    for (var tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
        var current = tokens[tokenIndex];
        if (current.title === null && /^-{4,}$/.test(current.value)) {
            finishCourse();
        } else {
            group.push(current);
        }
    }
    finishCourse();
    return courses;
}

function readTimetable() {
    if (document.querySelector('form[action*="LoginToXk"]')) {
        throw new Error('请先在学校网页完成登录，再打开「我的学期课表」。');
    }
    if (location.pathname !== '/jsxsd/xskb/xskb_list.do') pageChanged();

    var termSelectors = document.querySelectorAll('select#xnxq01id');
    var weekSelectors = document.querySelectorAll('select#zc');
    if (termSelectors.length !== 1 || weekSelectors.length !== 1) pageChanged();

    var term = termSelectors[0];
    var selectedTerm = term.selectedOptions[0];
    if (!selectedTerm || selectedTerm.disabled || !normalizedText(selectedTerm.textContent) || !/^\d{4}-\d{4}-[12]$/.test(term.value)) pageChanged();

    if (weekSelectors[0].value !== '0') {
        throw new Error('未完整提取学期课表，请将周次切换为「全部」，等待页面加载完成后重新提取。');
    }

    var weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    var tables = Array.prototype.slice.call(document.querySelectorAll('table')).filter(function (table) {
        var firstRow = table.rows[0];
        if (!firstRow || firstRow.cells.length !== 8) return false;
        return weekdays.every(function (label, columnIndex) {
            return normalizedText(firstRow.cells[columnIndex + 1].textContent) === label;
        });
    });
    if (tables.length !== 1) pageChanged();

    var table = tables[0];
    if (table.querySelector('table')) pageChanged();

    var rows = Array.prototype.slice.call(table.rows);
    var periodRows = rows.slice(1).filter(function (row) {
        return /^第/.test(normalizedText(row.cells[0] ? row.cells[0].textContent : ''));
    });
    if (periodRows.length !== 6) pageChanged();

    var courses = [];
    for (var rowIndex = 0; rowIndex < periodRows.length; rowIndex += 1) {
        var row = periodRows[rowIndex];
        var start = rowIndex * 2 + 1;
        var end = start + 1;
        if (row !== rows[rowIndex + 1] || row.cells.length !== 8) pageChanged();
        var label = normalizedText(row.cells[0].textContent).replace(/\s/g, '');
        if (row.cells[0].tagName !== 'TH' || (label !== '第' + start + '，' + end + '节' && label !== '第' + start + ',' + end + '节')) pageChanged();
        for (var day = 1; day <= 7; day += 1) {
            var cell = row.cells[day];
            if (cell.tagName !== 'TD' || cell.colSpan !== 1 || cell.rowSpan !== 1) pageChanged();
            courses = courses.concat(parseCell(cell, day, start, end));
        }
    }

    for (var tailIndex = 7; tailIndex < rows.length; tailIndex += 1) {
        var tailRow = rows[tailIndex];
        if (!tailRow.cells[0] || !tailRow.cells[1]) pageChanged();
        if (tailRow.cells.length !== 2) pageChanged();
        if (!/^备注[:：]$/.test(normalizedText(tailRow.cells[0].textContent))) pageChanged();
        if (normalizedText(tailRow.cells[1].textContent)) pageChanged();
    }

    if (courses.length === 0) {
        throw new Error('未提取到课程，请检查所选学期、周次是否为「全部」以及登录状态。');
    }

    return {
        semesterIdentifier: term.value,
        semesterDisplayName: normalizedText(selectedTerm.textContent),
        courses: courses
    };
}

function mergeSameCourses(courses) {
    var merged = {};
    var order = [];
    for (var index = 0; index < courses.length; index += 1) {
        var course = courses[index];
        var key = [
            course.name,
            course.teacher,
            course.position,
            course.day,
            course.startSection,
            course.endSection
        ].join('|');
        if (!Object.prototype.hasOwnProperty.call(merged, key)) {
            merged[key] = {
                name: course.name,
                teacher: course.teacher,
                position: course.position,
                day: course.day,
                startSection: course.startSection,
                endSection: course.endSection,
                weeks: course.weeks.slice()
            };
            order.push(key);
        } else {
            for (var weekIndex = 0; weekIndex < course.weeks.length; weekIndex += 1) {
                if (merged[key].weeks.indexOf(course.weeks[weekIndex]) === -1) {
                    merged[key].weeks.push(course.weeks[weekIndex]);
                }
            }
        }
    }
    return order.map(function (key) {
        var course = merged[key];
        course.weeks.sort(function (left, right) { return left - right; });
        return course;
    });
}

async function runImport() {
    var timetable = readTimetable();

    var confirmed = await window.shiguangBridgePromise.showAlert(
        '确认提取学期',
        '将提取当前网页所选的 ' + timetable.semesterDisplayName + ' 全部周次课表。若需其他学期，请取消并在网页切换后重新提取。',
        '提取此学期'
    );
    if (confirmed !== true) {
        window.shiguangBridge.showToast('已取消导入。');
        return;
    }

    if (JSON.stringify(readTimetable()) !== JSON.stringify(timetable)) {
        throw new Error('确认期间课表页面发生变化，请重新提取。');
    }

    var courses = mergeSameCourses(timetable.courses);
    var saved = await window.shiguangBridgePromise.saveImportedCourses(JSON.stringify(courses));
    if (saved !== true) {
        window.shiguangBridge.showToast('课表导入失败，请查看日志。');
        return;
    }

    window.shiguangBridge.showToast('成功导入 ' + courses.length + ' 门课程。');
    window.shiguangBridge.notifyTaskCompletion();
}

runImport().catch(function (error) {
    var message = error && error.message ? error.message : String(error);
    window.shiguangBridge.showToast(message);
    console.error('[ZSC] 导入失败：' + message);
});
