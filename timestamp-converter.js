import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const unixInput = document.getElementById('unix-input');
  const unixUnit = document.getElementById('unix-unit');
  const dateInput = document.getElementById('date-input');
  const zoneSelect = document.getElementById('timezone-select');
  const humanOutput = document.getElementById('human-output');
  const secondsOutput = document.getElementById('unix-seconds-output');
  const millisOutput = document.getElementById('unix-milliseconds-output');
  const copyHuman = document.getElementById('copy-human');
  const copySeconds = document.getElementById('copy-seconds');
  const copyMillis = document.getElementById('copy-millis');

  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  function populateZones() {
    const zones = typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [];
    if (zones.length) {
      zones.forEach(z => {
        const opt = document.createElement('option');
        opt.value = z;
        opt.textContent = z;
        zoneSelect.appendChild(opt);
      });
    } else {
      ['UTC', localZone].forEach(z => {
        const opt = document.createElement('option');
        opt.value = z;
        opt.textContent = z;
        zoneSelect.appendChild(opt);
      });
    }
    zoneSelect.value = localZone;
  }

  function formatDate(dt) {
    return dt.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ');
  }

  function updateFromUnix() {
    const val = parseFloat(unixInput.value);
    if (isNaN(val)) {
      humanOutput.value = '';
      return;
    }
    const zone = zoneSelect.value || localZone;
    const millis = unixUnit.value === 'ms' ? val : val * 1000;
    const dt = luxon.DateTime.fromMillis(millis, { zone });
    humanOutput.value = dt.isValid ? formatDate(dt) : '';
  }

  function tryParse(str, zone) {
    const formats = [
      'yyyy-LL-dd HH:mm:ss',
      'yyyy/LL/dd HH:mm:ss',
      'LL/dd/yyyy HH:mm:ss',
      'dd/LL/yyyy HH:mm:ss',
      'yyyy-LL-dd',
      'yyyy/LL/dd',
      'LL/dd/yyyy',
      'dd/LL/yyyy'
    ];
    for (const f of formats) {
      const dt = luxon.DateTime.fromFormat(str, f, { zone });
      if (dt.isValid) return dt;
    }
    let dt = luxon.DateTime.fromISO(str, { zone });
    if (dt.isValid) return dt;
    dt = luxon.DateTime.fromRFC2822(str, { zone });
    if (dt.isValid) return dt;
    const ms = Date.parse(str);
    return isNaN(ms) ? null : luxon.DateTime.fromMillis(ms, { zone });
  }

  function updateFromDate() {
    const zone = zoneSelect.value || localZone;
    const str = dateInput.value.trim();
    if (!str) {
      secondsOutput.value = '';
      millisOutput.value = '';
      return;
    }
    const dt = tryParse(str, zone);
    if (!dt) {
      secondsOutput.value = '';
      millisOutput.value = '';
      return;
    }
    secondsOutput.value = Math.floor(dt.toSeconds()).toString();
    millisOutput.value = dt.toMillis().toString();
  }

  if (copyHuman) copyHuman.addEventListener('click', () => {
    if (!humanOutput.value) return;
    navigator.clipboard.writeText(humanOutput.value).then(() => {
      showNotification('Copied to clipboard', 'success');
    });
  });

  if (copySeconds) copySeconds.addEventListener('click', () => {
    if (!secondsOutput.value) return;
    navigator.clipboard.writeText(secondsOutput.value).then(() => {
      showNotification('Copied to clipboard', 'success');
    });
  });

  if (copyMillis) copyMillis.addEventListener('click', () => {
    if (!millisOutput.value) return;
    navigator.clipboard.writeText(millisOutput.value).then(() => {
      showNotification('Copied to clipboard', 'success');
    });
  });

  [unixInput, unixUnit, zoneSelect].forEach(el => {
    if (el) el.addEventListener('input', updateFromUnix);
  });
  [dateInput, zoneSelect].forEach(el => {
    if (el) el.addEventListener('input', updateFromDate);
  });

  populateZones();
  updateFromUnix();
  updateFromDate();
});
