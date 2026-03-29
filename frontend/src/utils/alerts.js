import Swal from 'sweetalert2';

// Theming matching NexusFX Dark-mode
const customSwal = Swal.mixin({
  background: '#1A1E24',
  color: '#ffffff',
  confirmButtonColor: '#00E5FF', // accent primary
  cancelButtonColor: '#ff4d4f', // warning/danger
  customClass: {
    popup: 'nexus-swal-popup',
    title: 'nexus-swal-title',
    confirmButton: 'nexus-swal-confirm',
    cancelButton: 'nexus-swal-cancel',
  }
});

export const showAlert = async (message, title = 'NexusFX Alert') => {
  return customSwal.fire({
    title,
    text: message,
    icon: 'info',
    confirmButtonText: 'รับทราบ (OK)'
  });
};

export const showConfirm = async (message, title = 'ยืนยันการทำรายการ?') => {
  const result = await customSwal.fire({
    title,
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน (Confirm)',
    cancelButtonText: 'ยกเลิก (Cancel)'
  });
  return result.isConfirmed;
};

// Global Override Helper
export const setupGlobalAlerts = () => {
  window.alert = (msg) => {
    showAlert(msg);
  };
  
  // Custom global confirm replacement that returns a promise
  window.customConfirm = async (msg) => {
    return await showConfirm(msg);
  };
};
