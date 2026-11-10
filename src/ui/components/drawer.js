// ============================================================================
// Lexispelling V2 - Profile & Settings Drawer Manager
// ============================================================================

class ProfileDrawer {
  static init() {
    const backdrop = document.getElementById('drawer-backdrop');
    const closeBtn = document.getElementById('drawer-close-btn');
    const hamburgerBtn = document.getElementById('btn-hamburger');

    if (hamburgerBtn) {
      hamburgerBtn.onclick = () => ProfileDrawer.open();
    }
    if (closeBtn) {
      closeBtn.onclick = () => ProfileDrawer.close();
    }
    if (backdrop) {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) ProfileDrawer.close();
      };
    }

    // Attach profile form handlers
    const nameInput = document.getElementById('profile-name');
    const soundToggle = document.getElementById('profile-sound-toggle');
    const speedInput = document.getElementById('profile-tts-speed');
    const speedVal = document.getElementById('profile-tts-speed-val');
    const goalInput = document.getElementById('profile-daily-goal');
    const tutorToggle = document.getElementById('profile-tutor-toggle');

    if (speedInput && speedVal) {
      speedInput.oninput = (e) => {
        const val = e.target.value;
        speedVal.textContent = `${val}x`;
        if (window.ttsService) window.ttsService.setSpeechRate(val);
      };
    }

    const saveSettings = async () => {
      const updates = {
        displayName: nameInput ? nameInput.value.trim() : 'Estudiante',
        soundEnabled: soundToggle ? soundToggle.checked : true,
        ttsSpeechRate: speedInput ? parseFloat(speedInput.value) : 0.85,
        dailyHoursGoal: goalInput ? parseFloat(goalInput.value) : 0.5,
        tutorModeEnabled: tutorToggle ? tutorToggle.checked : false
      };

      if (window.soundFeedback) {
        window.soundFeedback.setMuted(!updates.soundEnabled);
      }

      await window.api.updateProfile(updates);
      window.store.set('profile', updates);
      window.ModalManager.showToast('Preferencias actualizadas', 'success');
    };

    if (nameInput) nameInput.onchange = saveSettings;
    if (soundToggle) soundToggle.onchange = saveSettings;
    if (speedInput) speedInput.onchange = saveSettings;
    if (goalInput) goalInput.onchange = saveSettings;
    if (tutorToggle) tutorToggle.onchange = saveSettings;
  }

  static open() {
    const backdrop = document.getElementById('drawer-backdrop');
    if (!backdrop) return;
    this.populate();
    backdrop.classList.add('open');
  }

  static close() {
    const backdrop = document.getElementById('drawer-backdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  static async populate() {
    const p = await window.api.getProfile();
    if (!p) return;

    const nameInput = document.getElementById('profile-name');
    const soundToggle = document.getElementById('profile-sound-toggle');
    const speedInput = document.getElementById('profile-tts-speed');
    const speedVal = document.getElementById('profile-tts-speed-val');
    const goalInput = document.getElementById('profile-daily-goal');
    const tutorToggle = document.getElementById('profile-tutor-toggle');
    const tutorCodeEl = document.getElementById('profile-tutor-code');

    if (nameInput) nameInput.value = p.displayName || '';
    if (soundToggle) soundToggle.checked = Boolean(p.soundEnabled);
    if (speedInput) {
      speedInput.value = p.ttsSpeechRate || 0.85;
      if (speedVal) speedVal.textContent = `${p.ttsSpeechRate || 0.85}x`;
      if (window.ttsService) window.ttsService.setSpeechRate(p.ttsSpeechRate || 0.85);
    }
    if (goalInput) goalInput.value = p.dailyHoursGoal || 0.5;
    if (tutorToggle) tutorToggle.checked = Boolean(p.tutorModeEnabled);
    if (tutorCodeEl) tutorCodeEl.textContent = p.tutorCode || 'LEX789';
  }
}

window.ProfileDrawer = ProfileDrawer;

