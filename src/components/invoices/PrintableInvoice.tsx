import React, { useState } from 'react';
import { Printer, X, FileText, CheckCircle, MapPin, Phone } from 'lucide-react';
import { Sale } from '../../types';
import { dbService } from '../../services/api';
import { formatBanglaCurrency, formatDate, toBnDigits } from '../../utils/bengaliNumbers';
import { numberToBanglaWords } from '../../utils/bengaliWords';
import { totalKgToMonKg } from '../../utils/weightConverter';

interface PrintableInvoiceProps {
  sale: Sale;
  onClose: () => void;
}

export const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ sale, onClose }) => {
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A5');
  const [mode, setMode] = useState<'INVOICE' | 'CHALLAN'>('INVOICE');

  const handlePrint = () => {
    dbService.system.print();
  };

  const isJuteItem = sale.sector === 'jute' || (sale.commodity_name && sale.commodity_name.includes('পাট'));
  const { mon: grossMonWhole, kg: grossKgRemainder } = totalKgToMonKg(sale.gross_weight_kg);
  const { mon: netMonWhole, kg: netKgRemainder } = totalKgToMonKg(sale.net_weight_kg);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Container */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[96vh] overflow-hidden border border-slate-300">
        {/* Controls Bar (Hidden in Print) */}
        <div className="print:hidden bg-black text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-white" />
            <span className="font-bold text-sm">ইনভয়েস ও চালান প্রিন্ট প্রিভিউ</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Paper Size selector */}
            <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaperSize('A5')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  paperSize === 'A5' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                A5 (হাফ পেইজ)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  paperSize === 'A4' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                A4 (ফুল পেইজ)
              </button>
            </div>

            {/* Document Mode selector */}
            <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('INVOICE')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  mode === 'INVOICE' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                বিল ও চালান
              </button>
              <button
                type="button"
                onClick={() => setMode('CHALLAN')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  mode === 'CHALLAN' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                শুধু ডেলিভারি চালান
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="bg-white hover:bg-neutral-200 text-black px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors border border-white"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-neutral-200 flex justify-center">
          <div
            id="printable-document"
            className={`bg-white shadow-xl border border-neutral-300 text-black mx-auto font-sans relative ${
              paperSize === 'A4'
                ? 'w-[210mm] min-h-[297mm] p-10 print:w-full print:p-0 print:border-none print:shadow-none'
                : 'w-[148mm] min-h-[210mm] p-6 print:w-full print:p-0 print:border-none print:shadow-none'
            }`}
            style={{
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3 mb-3">
              <div className="inline-block bg-black text-white text-[10px] font-bold px-3 py-0.5 rounded-full mb-1.5">
                বিসমিল্লাহির রাহমানির রাহিম
              </div>

              <div className="flex items-center justify-center gap-3.5 mb-1.5">
                <img
                  src="/logo.png"
                  alt="মাহা এন্টারপ্রাইজ লোগো"
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl shadow-xs border border-black"
                />
                <div className="text-left">
                  <h1 className="text-2xl sm:text-3xl font-black text-black tracking-wide leading-tight">
                    মাহা এন্টারপ্রাইজ
                  </h1>
                  <p className="text-xs sm:text-sm font-bold text-neutral-800">
                    মোঃ আব্দুর রশিদ সরকার এন্ড সন্স
                  </p>
                </div>
              </div>

              <p className="text-xs text-neutral-700">
                সরিষা, ভুট্টা, পাট, গম, ধান ও মৌসুমি শস্যের আড়ত এবং পাইকারি বিক্রেতা
              </p>
              <div className="flex items-center justify-center gap-4 text-xs font-semibold text-neutral-700 mt-0.5">
                <span>চাচকৈড় বাজার, গুরুদাসপুর, নাটোর</span>
                <span>•</span>
                <span>মোবাইল: 01711054499, 01711703241</span>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs space-y-0.5">
                <p><strong>চালান / বিল নং:</strong> <span className="font-mono text-sm font-bold">{sale.invoice_no}</span></p>
                <p><strong>তারিখ:</strong> {formatDate(sale.sale_date)}</p>
              </div>

              <div className="px-4 py-1 border-2 border-black rounded-lg text-sm font-black uppercase tracking-wider bg-neutral-100">
                {mode === 'INVOICE' ? 'বিক্রয় চালান ও ক্যাশ মেমো' : 'ডেলিভারি চালান (গেটপাস)'}
              </div>

              <div className="text-xs text-right space-y-0.5">
                <p><strong>গাড়ি/ট্রাক:</strong> {sale.truck_no || sale.vehicle_no || 'প্রযোজ্য নয়'}</p>
                <p><strong>ড্রাইভার:</strong> {sale.driver_name ? `${sale.driver_name}${sale.driver_phone ? ` (${sale.driver_phone})` : ''}` : 'প্রযোজ্য নয়'}</p>
              </div>
            </div>

            {/* Buyer Info Card */}
            <div className="bg-neutral-50 border border-neutral-300 rounded-lg p-3 mb-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-neutral-500">ক্রেতা / মিলের নাম:</span>
                  <p className="text-sm font-bold text-black">{sale.party_name}</p>
                </div>
                <div>
                  <span className="text-neutral-500">মোবাইল নম্বর:</span>
                  <p className="font-semibold text-neutral-800">{sale.party_phone || '---'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-neutral-500">গন্তব্য / ডেলিভারি ঠিকানা:</span>
                  <p className="font-semibold text-neutral-800">{sale.destination || sale.transport_info || sale.party_address || '---'}</p>
                </div>
              </div>
            </div>

            {/* Transport & Truck Details Strip */}
            {Boolean(sale.truck_no || sale.vehicle_no || sale.driver_name || sale.driver_phone || sale.transport_info || sale.destination) && (
              <div className="bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 mb-4 text-xs">
                <div className="font-bold text-black mb-1 flex items-center gap-1.5 border-b border-neutral-200 pb-1">
                  <span>🚛 পরিবহন ও ট্রাক বিবরণ:</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-neutral-700">
                  <div>
                    <span className="text-neutral-500 text-[11px] block">ট্রাক/গাড়ি নম্বর:</span>
                    <span className="font-bold font-mono text-black">{sale.truck_no || sale.vehicle_no || '---'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[11px] block">ড্রাইভারের নাম:</span>
                    <span className="font-semibold text-black">{sale.driver_name || '---'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[11px] block">ড্রাইভারের ফোন:</span>
                    <span className="font-mono text-black">{sale.driver_phone || '---'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[11px] block">পরিবহন / গন্তব্য:</span>
                    <span className="font-semibold text-black">{sale.transport_info || sale.destination || '---'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Item Table */}
            <table className="w-full text-xs border-collapse border border-neutral-400 mb-4">
              <thead>
                <tr className="bg-neutral-100 text-black text-center font-bold">
                  <th className="border border-neutral-400 py-1.5 px-2 w-10">ক্র:</th>
                  <th className="border border-neutral-400 py-1.5 px-2 text-left">শস্যের বিবরণ</th>
                  <th className="border border-neutral-400 py-1.5 px-2 w-16">মোট বস্তা</th>
                  <th className="border border-neutral-400 py-1.5 px-2">গ্রস ওজন</th>
                  <th className="border border-neutral-400 py-1.5 px-2 w-20">বস্তা বাদ</th>
                  <th className="border border-neutral-400 py-1.5 px-2">খাঁটি ওজন (মন + কেজি)</th>
                  {mode === 'INVOICE' && (
                    <>
                      <th className="border border-neutral-400 py-1.5 px-2 w-24">দর (প্রতি মন)</th>
                      <th className="border border-neutral-400 py-1.5 px-2 w-28 text-right">মোট টাকা</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="text-center">
                  <td className="border border-neutral-400 py-2 px-2">১</td>
                  <td className="border border-neutral-400 py-2 px-2 text-left font-bold text-black">
                    {sale.commodity_name}
                  </td>
                  <td className="border border-neutral-400 py-2 px-2 font-bold">
                    {isJuteItem ? '— (ওজনভিত্তিক)' : (sale.bags_count > 0 ? `${sale.bags_count} বস্তা` : '০ বস্তা (খোলা/লুজ)')}
                  </td>
                  <td className="border border-neutral-400 py-2 px-2">
                    {grossMonWhole} মন {grossKgRemainder} কেজি
                    <div className="text-[10px] text-neutral-500 font-mono">({sale.gross_weight_kg.toFixed(1)} কেজি)</div>
                  </td>
                  <td className="border border-neutral-400 py-2 px-2 font-semibold">
                    -{sale.bag_deduction_kg.toFixed(2)} কেজি
                  </td>
                  <td className="border border-neutral-400 py-2 px-2 font-bold text-black">
                    {netMonWhole} মন {netKgRemainder.toFixed(2)} কেজি
                    <div className="text-[10px] text-neutral-600 font-mono">({sale.net_weight_mon.toFixed(2)} মন)</div>
                  </td>
                  {mode === 'INVOICE' && (
                    <>
                      <td className="border border-neutral-400 py-2 px-2 font-bold">
                        ৳ {sale.rate_per_mon.toFixed(2)}
                      </td>
                      <td className="border border-neutral-400 py-2 px-2 text-right font-black">
                        {formatBanglaCurrency(sale.gross_amount, false, false)}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>

            {/* Calculations & Summary (Only for INVOICE mode) */}
            {mode === 'INVOICE' && (
              <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                {/* Bengali Words */}
                <div className="border border-neutral-300 rounded-lg p-3 bg-neutral-50 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-500">কথায় (টাকা):</span>
                    <p className="font-bold text-black mt-1 italic">
                      {numberToBanglaWords(sale.net_invoice_amount)}
                    </p>
                  </div>
                  {sale.notes && (
                    <div className="mt-3 pt-2 border-t border-neutral-200 text-[11px] text-neutral-600">
                      <strong>নোট:</strong> {sale.notes}
                    </div>
                  )}
                </div>

                {/* Amount breakdown */}
                <div className="border border-neutral-400 rounded-lg overflow-hidden text-xs">
                  <div className="flex justify-between px-3 py-1 border-b border-neutral-300">
                    <span>শস্যের মোট মূল্য:</span>
                    <span className="font-bold">{formatBanglaCurrency(sale.gross_amount, false, false)}</span>
                  </div>
                  {sale.loading_charge > 0 && (
                    <div className="flex justify-between px-3 py-1 border-b border-neutral-300 text-neutral-700">
                      <span>(+) লোডিং চার্জ:</span>
                      <span>{sale.loading_charge.toFixed(2)}</span>
                    </div>
                  )}
                  {sale.damaged_bag_deduction > 0 && (
                    <div className="flex justify-between px-3 py-1 border-b border-neutral-300">
                      <span>(-) ছেঁড়া/ভেজা বস্তা কর্তন:</span>
                      <span>-{sale.damaged_bag_deduction.toFixed(2)}</span>
                    </div>
                  )}
                  {sale.discount_amount > 0 && (
                    <div className="flex justify-between px-3 py-1 border-b border-neutral-300">
                      <span>(-) নগদ ছাড়:</span>
                      <span>-{sale.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-3 py-1.5 bg-neutral-100 font-black text-sm border-b border-neutral-400">
                    <span>সর্বমোট বিল:</span>
                    <span>৳ {formatBanglaCurrency(sale.net_invoice_amount, false, false)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1 font-bold border-b border-neutral-300">
                    <span>নগদ / জমা:</span>
                    <span>৳ {formatBanglaCurrency(sale.paid_amount, false, false)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1 font-bold bg-neutral-100">
                    <span>বর্তমান বকেয়া (Due):</span>
                    <span>৳ {formatBanglaCurrency(sale.due_amount, false, false)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Terms and conditions */}
            <div className="text-[10px] text-neutral-500 border-t border-neutral-200 pt-2 mb-8">
              * বিক্রিত মাল গাড়িতে তোলার পর কোনো ওজন ঘাটতি বা ক্ষতির জন্য আড়ত কর্তৃপক্ষ দায়ী থাকবে না। মালামাল চালানের সাথে মিলিয়ে বুঝে নিন।
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-3 gap-6 text-center text-xs font-bold text-neutral-800 pt-8 mt-auto">
              <div>
                <div className="border-t border-black pt-1">ক্রেতা / প্রতিনিধির স্বাক্ষর</div>
              </div>
              <div>
                <div className="border-t border-black pt-1">খালাসী / ড্রাইভারের স্বাক্ষর</div>
              </div>
              <div>
                <div className="border-t border-black pt-1 text-black font-black">
                  মাহা এন্টারপ্রাইজ পক্ষে
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

