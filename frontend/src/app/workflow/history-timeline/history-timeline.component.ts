import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowHistoryItem } from '../workflow.service';

@Component({
  selector: 'app-history-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-timeline.component.html',
  styleUrls: ['./history-timeline.component.scss'],
})
export class HistoryTimelineComponent {
  @Input() history: WorkflowHistoryItem[] = [];

  getDotClass(item: WorkflowHistoryItem): string {
    if (!item.endTime) return 'dot-pending';
    if (item.action === 'APPROVE') return 'dot-approved';
    if (item.action === 'RETURN' || item.action === 'RESUBMIT') return 'dot-returned';
    if (item.action === 'REJECT' || item.action === 'CANCEL') return 'dot-rejected';
    return 'dot-approved';
  }

  getDotIcon(item: WorkflowHistoryItem): string {
    if (!item.endTime) return '&#9679;';  // filled circle
    if (item.action === 'APPROVE') return '&#10003;';
    if (item.action === 'RETURN' || item.action === 'RESUBMIT') return '&#8634;';
    if (item.action === 'REJECT' || item.action === 'CANCEL') return '&#10007;';
    return '&#10003;';
  }

  getBadgeClass(item: WorkflowHistoryItem): string {
    if (!item.endTime) return 'badge-pending';
    if (item.action === 'APPROVE') return 'badge-approved';
    if (item.action === 'RETURN' || item.action === 'RESUBMIT') return 'badge-returned';
    if (item.action === 'REJECT' || item.action === 'CANCEL') return 'badge-rejected';
    return 'badge-approved';
  }

  getActionLabel(item: WorkflowHistoryItem): string {
    if (!item.endTime) return 'Đang chờ';
    switch (item.action) {
      case 'APPROVE': return 'Đã duyệt';
      case 'RETURN': return 'Trả lại';
      case 'REJECT': return 'Từ chối';
      case 'RESUBMIT': return 'Gửi lại';
      case 'CANCEL': return 'Hủy';
      default: return 'Hoàn thành';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN') + ' ' +
           d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  formatDuration(ms: number): string {
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    if (ms < 3600000) return Math.round(ms / 60000) + ' phút';
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return h + 'h' + (m > 0 ? m + 'p' : '');
  }
}
