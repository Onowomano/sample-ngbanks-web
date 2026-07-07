export type LogoFormat = "png" | "svg";

export type Bank = {
  name: string;
  category: string;
  aliases: string[];
  logos: {
    png: string;
    svg: string;
  };
};

export type LogoStyle = "circle" | "square";

export type BankSelectSource = "phone" | "desktop";

export type BankSelectDetail = {
  bank: Bank;
  style: LogoStyle;
  source: BankSelectSource;
};

export type ActionResult = {
  ok: boolean;
  message: string;
};
