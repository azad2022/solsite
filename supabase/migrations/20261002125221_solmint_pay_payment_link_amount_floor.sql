-- Prevent a merchant-paid Payment Link from becoming unpayable because the
-- canonical 1% ceiling fee would consume the entire principal.

alter table public.pay_payment_links
  drop constraint if exists pay_link_merchant_fee_rounding_check;

alter table public.pay_payment_links
  add constraint pay_link_merchant_fee_rounding_check
  check (
    fixed_amount_atomic is null
    or fee_payer <> 'merchant'
    or fixed_amount_atomic > ceil(fixed_amount_atomic * 100 / 10000)
  );
