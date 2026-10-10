export const EMPTY_TAG = {
  item: { name: "", category: "bag", description: "" },
  publicLabel: "",
  publicMessage: "",
  rewardOffered: false,
};

// Tag from the API -> TagForm initial values
export function toForm(tag) {
  return {
    item: {
      name: tag?.item?.name || "",
      category: tag?.item?.category || "bag",
      description: tag?.item?.description || "",
    },
    publicLabel: tag?.publicLabel || "",
    publicMessage: tag?.publicMessage || "",
    rewardOffered: Boolean(tag?.rewardOffered),
  };
}
