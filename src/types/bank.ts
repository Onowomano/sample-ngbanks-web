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

export type BankSelectDetail = {
  bank: Bank;
  style: LogoStyle;
};

export type ActionResult = {
  ok: boolean;
  message: string;
};
