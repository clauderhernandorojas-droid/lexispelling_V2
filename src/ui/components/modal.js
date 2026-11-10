// ============================================================================
// Lexispelling V2 - Modal & Toast Manager
// ============================================================================

class ModalManager {
  static showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  static openModal({ title, bodyHtml, confirmText = 'Aceptar', cancelText = 'Cancelar', onConfirm = null }) {
    const backdrop = document.getElementById('modal-backdrop');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    if (!backdrop) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    const closeModal = () => {
      backdrop.classList.remove('open');
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = () => {
      if (onConfirm) {
        const shouldClose = onConfirm();
        if (shouldClose !== false) {
          closeModal();
        }
      } else {
        closeModal();
      }
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };

    backdrop.classList.add('open');
  }

  static closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.remove('open');
  }
}

window.ModalManager = ModalManager;

