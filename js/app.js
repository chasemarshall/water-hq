// ===== User Management =====
const USERS = ['Chase', 'Mom', 'Dad', 'Sibling'];

function getCurrentUser() {
  return localStorage.getItem('showerTimerUser');
}

function setCurrentUser(name) {
  localStorage.setItem('showerTimerUser', name);
}

function clearCurrentUser() {
  localStorage.removeItem('showerTimerUser');
}

function renderUserSelect() {
  const container = document.getElementById('user-buttons');
  container.replaceChildren();
  USERS.forEach(name => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      setCurrentUser(name);
      showMainScreen();
    });
    container.appendChild(btn);
  });
}

function showUserSelect() {
  document.getElementById('user-select-screen').classList.remove('hidden');
  document.getElementById('main-screen').classList.add('hidden');
  renderUserSelect();
}

function showMainScreen() {
  const user = getCurrentUser();
  if (!user) return showUserSelect();
  document.getElementById('user-select-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  document.getElementById('current-user-badge').textContent = user;
  initFirebaseListeners();
}

// Switch user
document.getElementById('switch-user-btn').addEventListener('click', () => {
  clearCurrentUser();
  stopFirebaseListeners();
  showUserSelect();
});

// ===== Firebase Listeners =====
let statusRef, slotsRef, statusListener, slotsListener, timerInterval;

function initFirebaseListeners() {
  statusRef = db.ref('status');
  slotsRef = db.ref('slots');

  statusListener = statusRef.on('value', snapshot => {
    renderStatus(snapshot.val());
  });

  slotsListener = slotsRef.on('value', snapshot => {
    renderSlots(snapshot.val());
  });

  // Clean up yesterday's slots on load
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  db.ref('slots').orderByChild('date').endAt(yesterdayStr).once('value', function(snap) {
    snap.forEach(function(child) { child.ref.remove(); });
  });
}

function stopFirebaseListeners() {
  if (statusRef && statusListener) statusRef.off('value', statusListener);
  if (slotsRef && slotsListener) slotsRef.off('value', slotsListener);
  if (timerInterval) clearInterval(timerInterval);
}

// ===== Status Rendering =====
function renderStatus(status) {
  const banner = document.getElementById('status-banner');
  const text = document.getElementById('status-text');
  const timer = document.getElementById('status-timer');
  const btn = document.getElementById('shower-btn');
  const user = getCurrentUser();

  if (timerInterval) clearInterval(timerInterval);

  if (status && status.currentUser) {
    banner.className = 'status-occupied';
    text.textContent = 'OCCUPIED \u2014 ' + status.currentUser + ' is showering';
    timer.classList.remove('hidden');

    const startedAt = status.startedAt;
    function updateTimer() {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = elapsed % 60;
      timer.textContent = String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
      if (elapsed >= 1800 && status.currentUser === user) {
        clearInterval(timerInterval);
        stopShower();
      }
    }
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);

    if (status.currentUser === user) {
      btn.textContent = 'Done';
      btn.className = 'big-btn stop-btn';
      btn.disabled = false;
    } else {
      btn.textContent = status.currentUser + ' is showering...';
      btn.className = 'big-btn stop-btn';
      btn.disabled = true;
    }
  } else {
    banner.className = 'status-free';
    text.textContent = 'SHOWER FREE';
    timer.classList.add('hidden');
    timer.textContent = '';
    btn.textContent = 'Start Shower';
    btn.className = 'big-btn';
    btn.disabled = false;
  }
}

// ===== Shower Start/Stop =====
function startShower() {
  const user = getCurrentUser();
  db.ref('status').set({
    currentUser: user,
    startedAt: Date.now()
  });
}

function stopShower() {
  db.ref('status').set({
    currentUser: null,
    startedAt: null
  });
}

document.getElementById('shower-btn').addEventListener('click', () => {
  const btn = document.getElementById('shower-btn');
  if (btn.disabled) return;

  if (btn.textContent === 'Done') {
    stopShower();
  } else {
    // Check if someone has a slot starting within 5 minutes
    const now = new Date();
    if (currentSlots) {
      Object.values(currentSlots).forEach(slot => {
        if (slot.date === getToday()) {
          const parts = slot.startTime.split(':');
          const slotStart = new Date();
          slotStart.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
          const diffMin = (slotStart - now) / 60000;
          if (diffMin > 0 && diffMin <= 5) {
            alert('Heads up: ' + slot.user + ' has a slot at ' + slot.startTime + '. Starting anyway.');
          }
        }
      });
    }
    startShower();
  }
});

// ===== Slots Rendering =====
let currentSlots = null;

function getToday() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function formatTimeRange(startTime, durationMinutes) {
  const parts = startTime.split(':');
  const start = new Date();
  start.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const fmt = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return fmt(start) + ' \u2013 ' + fmt(end);
}

function renderSlots(slots) {
  currentSlots = slots;
  const list = document.getElementById('slots-list');
  list.replaceChildren();
  const today = getToday();
  const user = getCurrentUser();
  const now = new Date();

  if (!slots) {
    const empty = document.createElement('div');
    empty.className = 'no-slots';
    empty.textContent = 'No slots claimed for today';
    list.appendChild(empty);
    return;
  }

  const todaySlots = Object.entries(slots)
    .filter(function(entry) {
      return entry[1].date === today;
    })
    .filter(function(entry) {
      const s = entry[1];
      const parts = s.startTime.split(':');
      const endTime = new Date();
      endTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10) + s.durationMinutes, 0, 0);
      return endTime > now;
    })
    .sort(function(a, b) {
      return a[1].startTime.localeCompare(b[1].startTime);
    });

  if (todaySlots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-slots';
    empty.textContent = 'No slots claimed for today';
    list.appendChild(empty);
    return;
  }

  todaySlots.forEach(function(entry) {
    const id = entry[0];
    const slot = entry[1];
    const card = document.createElement('div');
    card.className = 'slot-card';

    const info = document.createElement('div');
    const userName = document.createElement('span');
    userName.className = 'slot-user';
    userName.textContent = slot.user;
    const timeSpan = document.createElement('span');
    timeSpan.className = 'slot-time';
    timeSpan.textContent = ' ' + formatTimeRange(slot.startTime, slot.durationMinutes);
    info.appendChild(userName);
    info.appendChild(timeSpan);
    card.appendChild(info);

    if (slot.user === user) {
      const delBtn = document.createElement('button');
      delBtn.className = 'slot-delete';
      delBtn.textContent = '\u2715';
      delBtn.addEventListener('click', function() {
        db.ref('slots/' + id).remove();
      });
      card.appendChild(delBtn);
    }
    list.appendChild(card);
  });
}

// ===== Claim Slot Modal =====
document.getElementById('claim-slot-btn').addEventListener('click', () => {
  const now = new Date();
  const min = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(min, 0, 0);
  if (min >= 60) now.setHours(now.getHours() + 1, 0, 0, 0);
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  document.getElementById('slot-time').value = timeStr;
  document.getElementById('claim-modal').classList.remove('hidden');
});

document.getElementById('cancel-claim-btn').addEventListener('click', () => {
  document.getElementById('claim-modal').classList.add('hidden');
});

document.getElementById('confirm-claim-btn').addEventListener('click', () => {
  const time = document.getElementById('slot-time').value;
  const duration = parseInt(document.getElementById('slot-duration').value, 10);
  const user = getCurrentUser();
  const today = getToday();

  if (!time) {
    alert('Please select a start time');
    return;
  }

  // Check for overlap
  if (currentSlots) {
    const newParts = time.split(':');
    const newStart = parseInt(newParts[0], 10) * 60 + parseInt(newParts[1], 10);
    const newEnd = newStart + duration;

    const overlap = Object.values(currentSlots).some(function(slot) {
      if (slot.date !== today) return false;
      const sParts = slot.startTime.split(':');
      const sStart = parseInt(sParts[0], 10) * 60 + parseInt(sParts[1], 10);
      const sEnd = sStart + slot.durationMinutes;
      return newStart < sEnd && newEnd > sStart;
    });

    if (overlap) {
      alert('This time overlaps with an existing slot. Pick a different time.');
      return;
    }
  }

  db.ref('slots').push({
    user: user,
    date: today,
    startTime: time,
    durationMinutes: duration
  });

  document.getElementById('claim-modal').classList.add('hidden');
});

// Close modal on backdrop click
document.getElementById('claim-modal').addEventListener('click', function(e) {
  if (e.target.id === 'claim-modal') {
    document.getElementById('claim-modal').classList.add('hidden');
  }
});

// ===== Init =====
if (getCurrentUser()) {
  showMainScreen();
} else {
  showUserSelect();
}
