sap.ui.define([
    "sap/ui/core/UIComponent"
], function (UIComponent) {
    "use strict";

    var Component = UIComponent.extend("my.component.sample.cardContentControls", {
        metadata: {
            manifest: "json"
        },

        // This method is called by the card host when the card is ready
        onCardReady: function (oCard) {
            // Store the card instance
            this.card = oCard;
            
            // Trigger API call after a short delay to ensure controller is initialized
            var that = this;
            setTimeout(function() {
                var oController = that.getRootControl() && that.getRootControl().getController();
                if (oController && oController.setTaskData) {
                    var oModel = oController.getView().getModel("Card");
                    if (oModel) {
                        oController.setTaskData(oCard, oModel);
                    }
                }
            }, 100);
        }
    });

    return Component;
});