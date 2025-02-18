import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { HeaderOrderStaffComponent } from '../ManagerOrder/HeaderOrderStaff/HeaderOrderStaff.component';
import { SidebarOrderComponent } from "../SidebarOrder/SidebarOrder.component";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InvoiceService } from '../../../service/invoice.service';
import { CurrencyFormatPipe } from '../../common/material/currencyFormat/currencyFormat.component';
import { CookingService } from '../../../service/cooking.service';
import { ExportService } from '../../../service/export.service';
import { NotificationService } from '../../../service/notification.service';
import { Title } from '@angular/platform-browser';
import { AccountService } from '../../../service/account.service';
import { SideBarComponent } from "../../manager/SideBar/SideBar.component";

@Component({
  selector: 'app-manage-invoice',
  templateUrl: './manage-invoice.component.html',
  styleUrls: ['./manage-invoice.component.css'],
  standalone: true,
  imports: [HeaderOrderStaffComponent, SidebarOrderComponent, FormsModule, CommonModule, CurrencyFormatPipe, SideBarComponent]
})
export class ManageInvoiceComponent implements OnInit {
  selectedTab: string = 'overview';
  data: any[] = [];
  orderCancel: any;
  orderShip: any;
  filteredOrders: any[] = [];
  filteredOrdersCancel: any[] = [];
  selectedEmployee: string = '';
  employees: any[] = [];

  dateFrom: string = '';
  dateTo: string = '';
  dateNow: string = '';
  selectedEmployeeName: string = '';
  orders: any;
  accountId: any;
  private reservationQueue: any[] = [];
  private socket!: WebSocket;

  constructor(private invoiceService: InvoiceService, private notificationService: NotificationService, private cookingService: CookingService, private exportService: ExportService, private titleService: Title, private accountService: AccountService) { }
  @ViewChild('collectAllModal') collectAllModal!: ElementRef;
  ngOnInit() {
    this.titleService.setTitle('Thống kê | Eating House');
    const today = new Date();
    this.dateFrom = this.formatDate(today);
    this.dateTo = this.formatDate(today);
    this.dateNow = this.formatDate(today);
    const accountIdString = localStorage.getItem('accountId');
    this.accountId = accountIdString ? Number(accountIdString) : null;
    if (this.accountId) {
      this.getAccountDetails(this.accountId);
    } else {
      console.error('Account ID is not available');
    }
    this.getReport();
    this.getNotificationByType(this.accountId);
    this.socket = new WebSocket('wss://localhost:7188/ws');
    this.socket.onopen = () => {
      while (this.reservationQueue.length > 0) {
        this.socket.send(this.reservationQueue.shift());
      }
    };
    this.socket.onclose = () => {
      console.log('WebSocket connection closed, attempting to reconnect...');
      setTimeout(() => {
        this.initializeWebSocket(); // Hàm khởi tạo WebSocket
      }, 5000); // Thử lại sau 5 giây
    };
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    this.getOrderPaymentOnline();
  }
  initializeWebSocket() {
    this.socket = new WebSocket('wss://localhost:7188/ws');
    this.socket.onopen = () => { /* xử lý onopen */ };
    this.socket.onmessage = (event) => { /* xử lý onmessage */ };
    this.socket.onclose = () => { /* xử lý onclose */ };
    this.socket.onerror = (error) => { /* xử lý onerror */ };
  }
  createNotification(orderId: number, accountId: number, check: boolean) {
    let description;
    if (check === true) {
      description = `Kính gửi Quý Khách. Chúng tôi xin thông báo rằng đơn hàng của Quý Khách tại Eating House với mã đơn hàng ${orderId} đã được hoàn tiền thành công. Số tiền sẽ được hoàn lại qua phương thức thanh toán mà Quý Khách đã sử dụng khi đặt hàng. Xin vui lòng kiểm tra tài khoản của mình để xác nhận giao dịch. Chúng tôi thành thật xin lỗi vì bất kỳ sự bất tiện nào mà điều này có thể đã gây ra. Nếu Quý Khách có bất kỳ thắc mắc nào liên quan đến việc hoàn tiền, vui lòng liên hệ với chúng tôi qua số điện thoại 0123456789 hoặc email eattinghouse@gmail.com. Cảm ơn Quý Khách đã tin tưởng và sử dụng dịch vụ của Eating House. Chúng tôi hy vọng sẽ có cơ hội được phục vụ Quý Khách trong tương lai!`;
    } else {
      description = `Đã nhận tiền giao hàng cho đơn hàng ${orderId}`;
    }
    const body = {
      description: description,
      accountId: accountId,
      orderId: orderId,
      type: 1
    }
    console.log(body);

    this.notificationService.createNotification(body).subscribe(
      response => {
        console.log(response);
        this.makeReservation(body.description);
      },
      error => {
        console.error('Error fetching account details:', error);
      }
    );
  }

  makeReservation(reservationData: any) {
    const message = JSON.stringify(reservationData);
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message); // Gửi yêu cầu đặt bàn khi WebSocket đã mở
    } else if (this.socket.readyState === WebSocket.CONNECTING) {
      this.reservationQueue.push(message);
    } else {
      console.log('WebSocket is not open. Current state:', this.socket.readyState);
    }
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  onDateFromChange(): void {
    this.getOrdersStatic();
    this.getOrderPaymentOnline();
    this.getReport();
  }

  onDateToChange(): void {
    if (this.dateTo < this.dateFrom) {
      this.dateFrom = this.dateTo;
    }
    this.getOrdersStatic();
    this.getOrderPaymentOnline();
    this.getReport();
  }

  getOrdersStatic(): void {
    console.log(this.accountId);
    if (this.role !== 3) {
      this.accountId = null;
    }
    console.log(this.role);

    console.log(this.accountId);

    this.invoiceService.getStatistics(this.dateFrom, this.dateTo, this.accountId).subscribe(
      response => {
        this.data = response;
        console.log(this.data);
      },
      error => {
        console.error('Error:', error);

      }
    );
  }
  report: any;
  getReport(): void {
    this.invoiceService.getReport(this.dateFrom, this.dateTo).subscribe(
      response => {
        this.report = response;
      },
      error => {
        console.error('Error:', error);

      }
    );
  }
  exportData(): void {
    this.getOrderExport();
  }
  role: any;
  getNotificationByType(accountId: number): void {
    this.notificationService.getType(accountId).subscribe(
      response => {
        this.role = response;
        this.getOrdersStatic();
      },
      error => {
        console.error('Error fetching account details:', error);
      }
    );
  }
  getOrderExport(): void {
    this.invoiceService.getOrderExport(this.data[0].orderIds).subscribe(
      response => {
        console.log(response);

        const flattenedData = this.flattenOrderData(response);
        console.log(flattenedData);
        this.exportService.exportToExcel(flattenedData, 'orders');
      },
      error => {
        console.error('Error:', error);
      }
    );
  }

  flattenOrderData(orders: any[]): any[] {
    const flattenedData: any[] = [];

    orders.forEach(order => {
      const orderInfo = {
        orderId: order.orderId,
        orderDate: this.formatDateTime(order.orderDate),
        status: "Hoàn thành",
        recevingOrder: this.formatDateTime(order.recevingOrder),
        totalAmount: order.totalAmount,
        guestPhone: order.guestPhone,
        deposits: order.deposits,
        note: order.note,
        cancelationReason: order.cancelationReason,
        invoiceId: order.invoice?.invoiceId,
        paymentTime: this.formatDateTime(order.invoice?.paymentTime),
        paymentAmount: order.invoice?.paymentAmount,
        taxcode: order.invoice?.taxcode,
        paymentStatus: order.invoice?.paymentStatus,
        customerName: order.invoice?.customerName,
        invoicePhone: order.invoice?.phone,
        invoiceAddress: order.invoice?.address,
        addressId: order.address?.addressId,
        guestAddress: order.address?.guestAddress,
        consigneeName: order.address?.consigneeName,
        guestEmail: order.guest?.email,
      };

      // Iterate through the orderDetails array to map each detail with its respective order information
      order.orderDetails.forEach((detail: { orderDetailId: any; dishName: string; unitPrice: number; quantity: number; dishesServed: any; }) => {
        const detailInfo = {
          orderDetailId: detail.orderDetailId,
          dishName: detail.dishName,
          unitPrice: detail.unitPrice,
          quantity: detail.quantity,
          dishesServed: detail.dishesServed
        };

        flattenedData.push({
          ...orderInfo,
          ...detailInfo
        });
      });
    });

    return flattenedData;
  }

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // Không sử dụng định dạng 12 giờ
    });
  }
  account: any;
  getAccountDetails(accountId: number): void {
    this.accountService.getAccountById(accountId).subscribe(
      response => {
        this.account = response;
        console.log('Account details:', this.account);
        console.log('Account role:', this.account.role);

      },
      error => {
        console.error('Error fetching account details:', error);
      }
    );
  }
  getOrderById(id: number): void {
    this.invoiceService.getOrderById(id).subscribe(
      response => {
        this.selectedItem = response;
        console.log(response);

      },
      error => {
        console.error('Error fetching account details:', error);
      }
    );
  }
  selectedItem: any;
  showDetails(id: any) {
    this.getOrderById(id);
  }

  showDetailsCashier: boolean = false;
  showDetailCashier(cashierId: number) {
    this.showDetailsCashier = true;
    const updatedReport = this.report.filter((order: any) => order.cashierId === cashierId);
    this.report = updatedReport;
    console.log(this.report);

  }
  goBack() {
    this.showDetailsCashier = false;
    this.getReport();
  }

  closePopup() {
    this.selectedItem = null;
  }
  totalPaymentOnline: any;
  getOrderPaymentOnline(): void {
    this.invoiceService.getOrderPaymentOnline(this.dateFrom, this.dateTo).subscribe(
      response => {
        this.totalPaymentOnline = response.totalPaymentAmount;
      },
      error => {
        console.error('Error fetching account details:', error);
      }
    );
  }
}
