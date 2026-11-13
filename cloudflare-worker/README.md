# মাহা এন্টারপ্রাইজ — ক্লাউডফ্লেয়ার ওয়ার্কার গেটওয়ে ও স্থায়ী ডোমেন সিঙ্ক নির্দেশিকা

এই মডিউলটি মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)-এর লোকাল PWA সার্ভার (`http://0.0.0.0:3030`) এবং ক্লাউডফ্লেয়ার টানেলকে আপনার স্থায়ী কাস্টম ডোমেইনে (`maha.nexobd.pro`) সার্বক্ষণিক সংযুক্ত রাখার জন্য প্রস্তুত করা হয়েছে।

---

## ১. আর্কিটেকচার ওভারভিউ

```text
[আইফোন / রিমোট ব্রাউজার Safari / Chrome]
                   │
                   ▼ (HTTPS)
 [https://maha.nexobd.pro] ──► (Cloudflare Worker প্রক্সি)
                                        │
                                        ▼ (UPSTREAM_URL + Host Rewriting)
                    [https://*.trycloudflare.com]
                                        │
                                        ▼ (Cloudflare Tunnel)
                  [দোকানের ল্যাপটপ: http://0.0.0.0:3030]
```

* **স্থায়ী ডোমেন:** আইফোনে একবার `https://maha.nexobd.pro` বুকমার্ক বা হোম স্ক্রিনে অ্যাড করলেই চলবে।
* **ক্যাশলেস লাইভ সিঙ্ক:** `Cache-Control: no-store, no-cache, must-revalidate` নিশ্চিত করে যে স্টক ও ক্যাশ লেনদেন তৎক্ষণাৎ রিয়েল-টাইমে রিফ্রেশ হবে।
* **অফলাইন গার্ড (502):** দোকানের ল্যাপটপ বন্ধ থাকলে রিমোট ব্যবহারকারীকে স্পষ্ট বাংলা মেসেজ দেখাবে:
  > *"দোকানের ল্যাপটপ বা সফটওয়্যার বর্তমানে অফলাইন আছে। অনুগ্রহ করে দোকানের ল্যাপটপ চেক করুন।"*

---

## ২. Error 522 (Connection timed out) সমাধান

`maha.nexobd.pro`-তে Error 522 আসার মূল কারণ ও সমাধান:

### কারণ ১: Host Header কনফ্লিক্ট (ফিক্সড)
ক্লাউডফ্লেয়ার টানেল `trycloudflare.com` ডোমেনের জন্য নিবন্ধিত থাকে। ওয়ার্কার থেকে রিকোয়েস্ট পাঠানোর সময় `Host: maha.nexobd.pro` পাঠানো হলে ক্লাউডফ্লেয়ার এজ বিভ্রান্ত হয়ে সংযোগ টাইমআউট করে (Error 522)।
**ফিক্স:** `cloudflare-worker/src/index.js`-এ `Host` হেডার স্বয়ংক্রিয়ভাবে আপস্ট্রিম হোস্টনেমে রিরাইট করা হয়েছে:
```javascript
const forwardHeaders = new Headers(request.headers);
forwardHeaders.set('Host', targetUrl.host);
forwardHeaders.set('X-Forwarded-Host', url.host);
```

### কারণ ২: মেয়াদোত্তীর্ণ বা নিষ্ক্রিয় UPSTREAM_URL
কুইক টানেল (`cloudflared tunnel --url http://localhost:3030`) যতবার রিস্টার্ট হয়, ততবার একটি নতুন র্যান্ডম URL দেয়। ওয়ার্কারে যদি পুরোনো লিঙ্ক সেট থাকে, ক্লাউডফ্লেয়ার মৃত লিঙ্কে কানেক্ট করতে গিয়ে Error 522 দেয়।
**ফিক্স:**
- ল্যাপটপে `start_tunnel.bat` চালু করে নতুন লিঙ্কটি কপি করুন।
- `update_upstream.bat` চালু করে নতুন লিঙ্কটি পেস্ট করুন (বা Cloudflare Dashboard-এ সেট করুন)।

### কারণ ৩: লাইভ হেলথ চেক ডায়াগনস্টিক
ওয়ার্কার ও আপস্ট্রিম সচল আছে কিনা তা সেকেন্ডের মধ্যে পরীক্ষা করতে ব্রাউজারে খুলুন:
```text
https://maha.nexobd.pro/api/worker-health
```
এটি সরাসরি রিপোর্ট করবে আপস্ট্রিম সক্রিয় কিনা এবং কোনো নেটওয়ার্ক লেটেন্সি আছে কিনা।

---

## ৩. সেটআপ ও ডিপ্লয়মেন্ট ধাপসমূহ

### ধাপ ১: Cloudflare Worker ডিপ্লয়
টার্মিনাল থেকে `cloudflare-worker` ফোল্ডারে প্রবেশ করে ডিপ্লয় কমান্ড চালান:
```bash
cd cloudflare-worker
npx wrangler deploy
```
*(অথবা সরাসরি [Cloudflare Dashboard](https://dash.cloudflare.com) > **Workers & Pages** > **Create Application** > **Worker** তৈরি করে `src/index.js`-এর সম্পূর্ণ কোড পেস্ট করে **Save and Deploy** দিন।)*

### ধাপ ২: কাস্টম ডোমেন বাইন্ডিং (`maha.nexobd.pro`)
১. Cloudflare Dashboard থেকে **Workers & Pages**-এ যান।
২. আপনার তৈরি করা `maha-enterprise-gateway` ওয়ার্কারে ক্লিক করুন।
৩. **Settings** > **Domains & Routes** ট্যাবে যান।
৪. **Add** > **Custom Domain** বাটনে ক্লিক করুন।
৫. ডোমেন ফিল্ডে লিখুন: `maha.nexobd.pro` (অথবা আপনার কাঙ্ক্ষিত সাবডোমেন)।
৬. **Add Custom Domain** চাপুন। ক্লাউডফ্লেয়ার স্বয়ংক্রিয়ভাবে SSL সার্টিফিকেট ইস্যু করে ডোমেন সক্রিয় করবে।

### ধাপ ৩: দোকানের ল্যাপটপে টানেল চালু করা
ল্যাপটপে মাহা এন্টারপ্রাইজ রুট ফোল্ডার থেকে `start_tunnel.bat` স্ক্রিপ্টটি ডাবল ক্লিক করে চালু করুন।
অথবা টার্মিনালে চালান:
```powershell
cloudflared tunnel --url http://localhost:3030
```
টার্মিনালে আপনি একটি লিঙ্ক দেখতে পাবেন, যেমন:
`https://anymore-scholar-thesaurus-magnetic.trycloudflare.com`

### ধাপ ৪: UPSTREAM_URL আপডেট করা
যখনই নতুন কুইক টানেল লিঙ্ক তৈরি হবে, ওয়ার্কারের আপস্ট্রিম ভেরিয়েবল আপডেট করার ২টি সহজ উপায়:
* **পদ্ধতি ১ (রুট ফোল্ডারের স্ক্রিপ্ট):**
  রুট ফোল্ডারের `update_upstream.bat` ডাবল ক্লিক করুন এবং নতুন লিংক পেস্ট করুন।
* **পদ্ধতি ২ (Wrangler CLI):**
  ```bash
  cd cloudflare-worker
  npx wrangler secret put UPSTREAM_URL
  ```
* **পদ্ধতি ৩ (Cloudflare Dashboard):**
  - Worker > **Settings** > **Variables and Secrets**
  - `UPSTREAM_URL` ভেরিয়েবলে নতুন `https://*.trycloudflare.com` লিঙ্ক সেভ করুন।

---

## ৪. পার্মানেন্ট জিরো-ওয়ার্কার টানেল (স্থায়ী লিঙ্ক, কোনো ওয়ার্কার আপডেট লাগবে না!)
আপনি যদি বারবার লিঙ্ক পরিবর্তন করার ঝামেলা একদমই না চান:
১. Cloudflare Dashboard > **Zero Trust** > **Networks** > **Tunnels**-এ যান।
২. **Add a Tunnel** > Cloudflared নির্বাচন করুন।
৩. টানেল নাম দিন: `maha-shop-tunnel`।
৪. দেওয়া ইনস্টলেশন টোকেনটি কপি করে ল্যাপটপে চালান:
   ```cmd
   cloudflared service install <YOUR_TOKEN>
   ```
৫. **Public Hostname** সেকশনে কনফিগার করুন:
   - Subdomain: `maha`
   - Domain: `nexobd.pro`
   - Service: `HTTP://localhost:3030`
৬. **Save** চাপুন!
এখন থেকে `https://maha.nexobd.pro` সরাসরি আপনার দোকানের ল্যাপটপের পোর্ট ৩০৩০-এ স্থায়ীভাবে কানেক্ট হবে, কোনো ট্রাই-ক্লাউডফ্লেয়ার বা ওয়ার্কার পরিবর্তনের প্রয়োজন হবে না!
